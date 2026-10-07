// app/api/admin/logout/route.ts
//
// POST /api/admin/logout
// Always returns 204. Clears both cookies; session is self-validating
// (HMAC) so the only way to invalidate is to delete the cookie —
// that's what the browser does on its own when Max-Age=0 lands.

import { NextResponse } from "next/server";
import { buildLogoutCookieHeaders } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function POST() {
    const headers = new Headers();
    for (const h of buildLogoutCookieHeaders()) {
        headers.append("Set-Cookie", h);
    }
    return new NextResponse(null, { status: 204, headers });
}