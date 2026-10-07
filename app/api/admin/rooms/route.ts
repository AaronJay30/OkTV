import { NextResponse } from "next/server";
import { get, ref, remove } from "firebase/database";
import { requireAdmin } from "@/lib/admin-auth";
import { rtdb } from "@/lib/firebase";
import { normalizeRoom, roomIsIdle } from "@/lib/admin-room";
import { writeAdminAudit } from "@/lib/admin-audit";

function cookies(request: Request) {
    const map = new Map<string, { value: string }>();
    for (const part of (request.headers.get("cookie") ?? "").split(/;\s*/)) {
        const i = part.indexOf("="); if (i > 0) map.set(part.slice(0, i), { value: decodeURIComponent(part.slice(i + 1)) });
    }
    return { get: (name: string) => map.get(name) };
}

export async function GET(request: Request) {
    const guard = requireAdmin({ cookies: cookies(request), headers: request.headers, method: "GET" });
    if (!guard.ok) return NextResponse.json({}, { status: guard.status });
    const snapshot = await get(ref(rtdb, "rooms"));
    const raw = snapshot.exists() ? snapshot.val() : {};
    const rooms = Object.entries(raw && typeof raw === "object" ? raw : {}).map(([id, room]) => normalizeRoom(id, room));
    return NextResponse.json({ rooms, generatedAt: new Date().toISOString() });
}

export async function POST(request: Request) {
    const guard = requireAdmin({ cookies: cookies(request), headers: request.headers, method: "POST" });
    if (!guard.ok) return NextResponse.json({}, { status: guard.status });
    let body: { hours?: unknown };
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
    const hours = typeof body.hours === "number" && Number.isFinite(body.hours) ? body.hours : 24;
    if (hours <= 0 || hours > 24 * 365) return NextResponse.json({ error: "hours must be between 1 and 8760" }, { status: 400 });
    const snapshot = await get(ref(rtdb, "rooms"));
    const raw = snapshot.exists() ? snapshot.val() : {};
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    const ids = Object.entries(raw && typeof raw === "object" ? raw : {}).filter(([, room]) => roomIsIdle(room, cutoff)).map(([id]) => id);
    await Promise.all(ids.map((id) => remove(ref(rtdb, `rooms/${id}`))));
    if (ids.length) await writeAdminAudit("room.purge", { hours, roomIds: ids });
    return NextResponse.json({ deleted: ids.length, roomIds: ids });
}
