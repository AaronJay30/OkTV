// app/api/admin/keys/route.ts
//
// GET /api/admin/keys
//
// Auth-required. Returns the current per-slot YouTube API key stats
// from the in-memory counters (spec 04 §6). Only slots that have been
// used since the last restart appear — that matches the spec's "show
// what's actually burning quota" intent.
//
// Response shape:
//   {
//     slots: [
//       {
//         label: "legacy" | "1" | "2" | ...,
//         last4: string,
//         totalRequests: number,
//         totalUnits: number,
//         last24hRequests: number,
//         quotaExceededAt: ISO string | null,
//         pctOfDailyQuota: number, // 0..1+
//       },
//       ...
//     ],
//     generatedAt: ISO string
//   }
//
// Note: the daily quota cap is a YouTube project default (10k). If a
// project has a higher cap this number would be misleading — out of
// scope for v1, see spec §10 follow-ups.

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { readSlotStats } from "@/lib/youtube-rotating-key";
import { YOUTUBE_DAILY_QUOTA_PER_KEY } from "@/lib/youtube-rotating-key-types";

export const runtime = "nodejs";

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

    const raw = readSlotStats();
    const slots = raw.map((s) => ({
        label: s.label,
        last4: s.last4,
        totalRequests: s.totalRequests,
        totalUnits: s.totalUnits,
        last24hRequests: s.last24hRequests ?? s.recent.length,
        quotaExceededAt:
            s.quotaExceededAt !== null
                ? new Date(s.quotaExceededAt).toISOString()
                : null,
        pctOfDailyQuota: s.totalUnits / YOUTUBE_DAILY_QUOTA_PER_KEY,
    }));

    return NextResponse.json(
        {
            slots,
            generatedAt: new Date().toISOString(),
        },
        { status: 200 }
    );
}