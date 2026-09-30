import { NextRequest, NextResponse } from "next/server";
import {
    withRotatingKey,
    type RotatingKeyResult,
} from "@/lib/youtube-rotating-key";

/**
 * GET /api/youtube/enrich?ids=<id1>,<id2>,...
 *
 * Best-effort metadata enrichment for URL-bypassed songs. Calls YouTube's
 * `videos.list` (1 quota unit per call, up to 50 ids per call) through the
 * same key-rotation pool as /api/youtube/search.
 *
 * Behavior:
 *  - Success → 200 { items: [{ id, title, channel, thumbnail, duration }, ...] }
 *  - Empty `ids` → 400 { error: "MISSING_IDS" }
 *  - >50 ids → 400 { error: "TOO_MANY_IDS", max: 50 }
 *  - Pool exhausted → 429 { error: "QUOTA_EXHAUSTED", message }
 *  - YouTube returned 200 with no items (e.g. all IDs invalid) → 200 { items: [] }
 *
 * Client treats 200-with-empty-items and 429 identically: fall back to the
 * generic "YouTube video (<id>)" title.
 *
 * Spec: specs/02-custom-url-search.md §5
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const YOUTUBE_VIDEOS_ENDPOINT =
    "https://www.googleapis.com/youtube/v3/videos";

const MAX_IDS = 50;

function parseIso8601Duration(iso: string | undefined): string | undefined {
    if (!iso) return undefined;
    // Minimal PTYHM S parser — YouTube's contentDetails.duration is always
    // in this format ("PT3M42S", "PT1H2M3S", "PT45S", "PT10M").
    const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
    if (!m) return undefined;
    const h = m[1] ? parseInt(m[1], 10) : 0;
    const min = m[2] ? parseInt(m[2], 10) : 0;
    const s = m[3] ? parseInt(m[3], 10) : 0;
    const totalSeconds = h * 3600 + min * 60 + s;
    if (totalSeconds <= 0) return undefined;
    const hh = Math.floor(totalSeconds / 3600);
    const mm = Math.floor((totalSeconds % 3600) / 60);
    const ss = totalSeconds % 60;
    if (hh > 0) {
        return `${hh}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
    }
    return `${mm}:${String(ss).padStart(2, "0")}`;
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const raw = searchParams.get("ids")?.trim();

    if (!raw) {
        return NextResponse.json(
            {
                error: "MISSING_IDS",
                message: "Query parameter 'ids' is required.",
            },
            { status: 400 }
        );
    }

    // YouTube IDs are 11 chars [A-Za-z0-9_-]. Strip anything else to avoid
    // surfacing a parse error for accidental user input.
    const ids = raw
        .split(",")
        .map((id) => id.trim())
        .filter((id) => /^[A-Za-z0-9_-]{11}$/.test(id));

    if (ids.length === 0) {
        return NextResponse.json(
            {
                error: "MISSING_IDS",
                message: "No valid video IDs in 'ids'.",
            },
            { status: 400 }
        );
    }

    if (ids.length > MAX_IDS) {
        return NextResponse.json(
            {
                error: "TOO_MANY_IDS",
                max: MAX_IDS,
                message: `At most ${MAX_IDS} ids per call.`,
            },
            { status: 400 }
        );
    }

    const result: RotatingKeyResult<{ items: any[] }> = await withRotatingKey(
        async (apiKey: string) => {
            const url =
                `${YOUTUBE_VIDEOS_ENDPOINT}` +
                `?part=snippet,contentDetails` +
                `&id=${encodeURIComponent(ids.join(","))}` +
                `&key=${apiKey}`;

            let response: Response;
            try {
                response = await fetch(url, { cache: "no-store" });
            } catch (err) {
                return {
                    ok: false as const,
                    status: 502,
                    body: {
                        error: "UPSTREAM_FETCH_FAILED",
                        message: String(err),
                    },
                };
            }

            let body: any = null;
            try {
                body = await response.json();
            } catch {
                body = null;
            }

            if (!response.ok) {
                return {
                    ok: false as const,
                    status: response.status,
                    body,
                };
            }

            const rawItems = Array.isArray(body?.items) ? body.items : [];
            const items = rawItems.map((it: any) => {
                const id = it?.id ?? "";
                const sn = it?.snippet ?? {};
                const cd = it?.contentDetails ?? {};
                const thumbs = sn?.thumbnails ?? {};
                const bestThumb =
                    thumbs.maxres?.url ||
                    thumbs.high?.url ||
                    thumbs.medium?.url ||
                    thumbs.default?.url ||
                    `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
                return {
                    id,
                    title: sn?.title ?? "",
                    channel: sn?.channelTitle ?? "",
                    thumbnail: bestThumb,
                    duration: parseIso8601Duration(cd?.duration),
                };
            });

            return {
                ok: true as const,
                data: { items },
            };
        }
    );

    if (result.ok) {
        return NextResponse.json(result.data, { status: 200 });
    }

    if (result.status === 429) {
        return NextResponse.json(result.body, { status: 429 });
    }

    // Non-quota failure: return upstream body (or generic envelope)
    return NextResponse.json(
        result.body ?? { error: "UPSTREAM_ERROR", status: result.status },
        { status: result.status || 500 }
    );
}