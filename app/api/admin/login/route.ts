// app/api/admin/login/route.ts
//
// POST /api/admin/login
// Body: { password: string }
// Returns:
//   204 No Content + Set-Cookie headers on success
//   429 + Retry-After on rate limit
//   503 ADMIN_NOT_CONFIGURED when ADMIN_PASSWORD_HASH /
//       ADMIN_SESSION_SECRET are missing
//   401 (no body) on bad password — collapsed with "not configured" so the
//       caller can't probe.
//
// Rate limit: 5 attempts / 60s / IP, checked before bcrypt.
// Bcrypt cost 11 (~100ms), configured via the hash env var.

import { NextResponse } from "next/server";
import {
    buildLoginCookieHeaders,
    checkLoginRate,
    clearLoginRate,
    getAdminConfigError,
    getClientIp,
    issueAdminToken,
    issueCsrfToken,
    verifyAdminPassword,
} from "@/lib/admin-auth";

export const runtime = "nodejs"; // bcryptjs is fine on edge, but rate-limiter Map is shared across routes — keep on Node runtime.

interface LoginBody {
    password?: unknown;
}

export async function POST(request: Request) {
    if (getAdminConfigError()) {
        return NextResponse.json(
            { error: "ADMIN_NOT_CONFIGURED" },
            { status: 503 }
        );
    }

    const ip = getClientIp(request.headers);
    const rate = checkLoginRate(ip);
    if (!rate.ok) {
        return new NextResponse(null, {
            status: 429,
            headers: {
                "Retry-After": String(Math.ceil(rate.retryMs / 1000)),
            },
        });
    }

    // Parse body. We accept JSON or form-encoded for convenience but
    // JSON is preferred. Both end up in the same shape.
    let body: LoginBody;
    try {
        const ct = request.headers.get("content-type") ?? "";
        if (ct.includes("application/json")) {
            body = (await request.json()) as LoginBody;
        } else {
            const form = await request.formData();
            body = { password: form.get("password") };
        }
    } catch {
        return new NextResponse(null, { status: 401 });
    }

    const password =
        typeof body.password === "string" ? body.password : "";

    if (!password) {
        return new NextResponse(null, { status: 401 });
    }

    const ok = await verifyAdminPassword(password);
    if (!ok) {
        // Intentionally vague — same status as missing-field.
        return new NextResponse(null, { status: 401 });
    }

    // Successful login: clear throttle and mint cookies.
    clearLoginRate(ip);
    const token = issueAdminToken();
    const csrf = issueCsrfToken();

    const headers = new Headers();
    for (const h of buildLoginCookieHeaders(token, csrf)) {
        headers.append("Set-Cookie", h);
    }

    return new NextResponse(null, { status: 204, headers });
}