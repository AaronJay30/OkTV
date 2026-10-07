import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { readAdminAudit } from "@/lib/admin-audit";

function cookies(request: Request) {
    const map = new Map<string, { value: string }>();
    for (const part of (request.headers.get("cookie") ?? "").split(/;\s*/)) { const i = part.indexOf("="); if (i > 0) map.set(part.slice(0, i), { value: decodeURIComponent(part.slice(i + 1)) }); }
    return { get: (name: string) => map.get(name) };
}

export async function GET(request: Request) {
    const guard = requireAdmin({ cookies: cookies(request), headers: request.headers, method: "GET" });
    if (!guard.ok) return NextResponse.json({}, { status: guard.status });
    return NextResponse.json({ entries: await readAdminAudit(50) });
}
