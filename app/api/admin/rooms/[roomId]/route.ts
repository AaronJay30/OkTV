import { NextResponse } from "next/server";
import { remove, ref } from "firebase/database";
import { requireAdmin } from "@/lib/admin-auth";
import { rtdb } from "@/lib/firebase";
import { writeAdminAudit } from "@/lib/admin-audit";

function cookies(request: Request) {
    const map = new Map<string, { value: string }>();
    for (const part of (request.headers.get("cookie") ?? "").split(/;\s*/)) { const i = part.indexOf("="); if (i > 0) map.set(part.slice(0, i), { value: decodeURIComponent(part.slice(i + 1)) }); }
    return { get: (name: string) => map.get(name) };
}

export async function DELETE(request: Request, context: { params: { roomId: string } }) {
    const guard = requireAdmin({ cookies: cookies(request), headers: request.headers, method: "DELETE" });
    if (!guard.ok) return NextResponse.json({}, { status: guard.status });
    const roomId = context.params.roomId;
    if (!roomId || roomId.length > 128) return NextResponse.json({}, { status: 400 });
    await remove(ref(rtdb, `rooms/${roomId}`));
    await writeAdminAudit("room.delete", { roomId });
    return new NextResponse(null, { status: 204 });
}
