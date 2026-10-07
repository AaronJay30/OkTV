// app/api/admin/flags/route.ts
//
// GET  /api/admin/flags — read current flags (auth-required).
// PUT  /api/admin/flags — replace flags with the body (auth-required).
//
// Body shape:
//   {
//     phoneMicEnabled: boolean,
//     scorerEnabled: boolean,
//     createRoomModalEnabled: boolean
//   }
//
// Any field not present is rejected — flag writes are an explicit
// "set all three" operation so we don't end up with half-updated
// state from a partial payload.

import { NextResponse } from "next/server";
import { ref, get, set } from "firebase/database";
import { requireAdmin } from "@/lib/admin-auth";
import { rtdb } from "@/lib/firebase";
import { writeAdminAudit } from "@/lib/admin-audit";

export const runtime = "nodejs";

const ALLOWED_KEYS = ["phoneMicEnabled", "scorerEnabled"] as const;
type FlagKey = (typeof ALLOWED_KEYS)[number];
type FlagsPayload = Record<FlagKey, boolean>;

function isFlagsPayload(v: unknown): v is FlagsPayload {
    if (!v || typeof v !== "object") return false;
    const r = v as Record<string, unknown>;
    return ALLOWED_KEYS.every((k) => typeof r[k] === "boolean");
}

function cookieBagFromRequest(request: Request) {
    const raw = request.headers.get("cookie") ?? "";
    const map = new Map<string, { value: string }>();
    for (const part of raw.split(/;\s*/)) {
        if (!part) continue;
        const eq = part.indexOf("=");
        if (eq < 0) continue;
        const k = part.slice(0, eq).trim();
        const v = part.slice(eq + 1).trim();
        if (k) map.set(k, { value: decodeURIComponent(v) });
    }
    return { get: (name: string) => map.get(name) };
}

export async function GET(request: Request) {
    const guard = requireAdmin({
        cookies: cookieBagFromRequest(request),
        headers: request.headers,
        method: "GET",
    });
    if (!guard.ok) {
        return NextResponse.json({}, { status: guard.status });
    }
    try {
        const snap = await get(ref(rtdb, "config/flags"));
        const raw = snap && typeof snap.val === "function" ? snap.val() : null;
        // Strip any stale createRoomModalEnabled from older payloads.
        const stripped = raw && typeof raw === "object"
            ? {
                  phoneMicEnabled: !!(raw as Record<string, unknown>).phoneMicEnabled,
                  scorerEnabled: !!(raw as Record<string, unknown>).scorerEnabled,
              }
            : {};
        return NextResponse.json(stripped, { status: 200 });
    } catch {
        return NextResponse.json({}, { status: 200 });
    }
}

export async function PUT(request: Request) {
    const guard = requireAdmin({
        cookies: cookieBagFromRequest(request),
        headers: request.headers,
        method: "PUT",
    });
    if (!guard.ok) {
        return NextResponse.json({}, { status: guard.status });
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    if (!isFlagsPayload(body)) {
        return NextResponse.json(
            {
                error: `Body must contain boolean values for: ${ALLOWED_KEYS.join(", ")}`,
            },
            { status: 400 }
        );
    }

    try {
        await set(ref(rtdb, "config/flags"), body);
        await writeAdminAudit("flag.update", body);
        return NextResponse.json(body, { status: 200 });
    } catch (e) {
        console.error("flags PUT failed", e);
        // NOTE: this is the most common failure mode — RTDB rules reject
        // writes to /config/flags. The spec tracks this gap at §7.1:
        // RTDB rules can't see HMAC cookies, so the server-side auth
        // check here passes but Firebase refuses the write.
        //
        // Quick fix (until Admin SDK is wired): in Firebase Console,
        // change the rules so /config/flags is writable. See §7.1.
        return NextResponse.json(
            {
                error: "Failed to write flags",
                hint: "RTDB rules may be blocking. See specs/04-admin-dashboard.md §7.1.",
                detail: e instanceof Error ? e.message : String(e),
            },
            { status: 500 }
        );
    }
}

export type { FlagsPayload };
