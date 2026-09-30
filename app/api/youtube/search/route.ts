import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/youtube/search?q=<query>
 *
 * Proxies a YouTube Data API v3 `search.list` request with automatic
 * API-key rotation. The pool is built from environment variables:
 *   - YOUTUBE_API_KEY        (legacy single key)
 *   - YOUTUBE_API_KEY_1, YOUTUBE_API_KEY_2, YOUTUBE_API_KEY_3, ...
 *
 * When a key returns a quota-class error (rateLimitExceeded, quotaExceeded,
 * userRateLimitExceeded, dailyLimitExceeded), we log a warning and retry with
 * the next key. If every key is exhausted we respond with HTTP 429 and
 * `{ error: "QUOTA_EXHAUSTED" }`.
 *
 * Spec: specs/01-rotational-api-key.md
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const YOUTUBE_SEARCH_ENDPOINT =
    "https://www.googleapis.com/youtube/v3/search";

// Reasons we treat as "quota class" — rotation is safe and warranted.
// See §4.5 of the spec for the canonical error body shape.
const QUOTA_REASONS = new Set([
    "quotaExceeded",
    "rateLimitExceeded",
    "userRateLimitExceeded",
    "dailyLimitExceeded",
]);

function loadApiKeys(): string[] {
    const keys: string[] = [];

    // Legacy single-key env var (kept for backwards compatibility).
    const legacy = process.env.YOUTUBE_API_KEY;
    if (legacy && legacy.trim()) {
        keys.push(legacy.trim());
    }

    // Numbered pool: YOUTUBE_API_KEY_1, _2, _3, ...
    // The slot count is configurable via YOUTUBE_API_KEY_MAX_SLOTS so
    // operators can run with 8 today and 12 tomorrow without code changes.
    const maxSlots = parseMaxSlots(process.env.YOUTUBE_API_KEY_MAX_SLOTS);
    for (let i = 1; i <= maxSlots; i++) {
        const k = process.env[`YOUTUBE_API_KEY_${i}`];
        if (k && k.trim()) {
            keys.push(k.trim());
        }
    }

    // De-duplicate while preserving order.
    return Array.from(new Set(keys));
}

/**
 * Parse `YOUTUBE_API_KEY_MAX_SLOTS`. Default is 20. Any non-integer, missing,
 * or out-of-range value falls back to the default. Hard ceiling of 100
 * protects against typos like `=1000` causing runaway loops.
 */
function parseMaxSlots(value: string | undefined): number {
    const DEFAULT = 20;
    const MIN = 1;
    const MAX = 100;
    if (value === undefined || value === null) return DEFAULT;
    const trimmed = value.trim();
    if (trimmed === "") return DEFAULT;
    const n = Number(trimmed);
    if (!Number.isFinite(n) || !Number.isInteger(n)) return DEFAULT;
    if (n < MIN || n > MAX) return DEFAULT;
    return n;
}

/**
 * Parse a boolean env var. Default is `true` (rotation enabled) unless the
 * value is explicitly one of: "false", "0", "no", "off" (case-insensitive).
 * Empty string and missing var both fall back to the default.
 */
function parseBool(value: string | undefined, defaultValue: boolean): boolean {
    if (value === undefined || value === null) return defaultValue;
    const v = value.trim().toLowerCase();
    if (v === "") return defaultValue;
    if (v === "false" || v === "0" || v === "no" || v === "off") return false;
    return true;
}

function isQuotaError(payload: any): boolean {
    if (!payload || !Array.isArray(payload.error?.errors)) return false;
    return payload.error.errors.some((e: any) =>
        QUOTA_REASONS.has(e?.reason ?? "")
    );
}

type CallResult =
    | { ok: true; data: any }
    | { ok: false; status: number; body: any };

async function callYouTube(query: string, apiKey: string): Promise<CallResult> {
    const url =
        `${YOUTUBE_SEARCH_ENDPOINT}` +
        `?part=snippet&maxResults=30` +
        `&q=${encodeURIComponent(query + " karaoke")}` +
        `&type=video&videoEmbeddable=true` +
        `&key=${apiKey}`;

    let response: Response;
    try {
        response = await fetch(url, { cache: "no-store" });
    } catch (err) {
        return {
            ok: false,
            status: 502,
            body: {
                error: "UPSTREAM_FETCH_FAILED",
                message: String(err),
            },
        };
    }

    // Always parse JSON so we can inspect `error.errors[*].reason`.
    let body: any = null;
    try {
        body = await response.json();
    } catch {
        body = null;
    }

    if (response.ok) {
        return { ok: true, data: body };
    }

    return { ok: false, status: response.status, body };
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim();

    if (!query) {
        return NextResponse.json(
            {
                error: "MISSING_QUERY",
                message: "Query parameter 'q' is required.",
            },
            { status: 400 }
        );
    }

    const keys = loadApiKeys();

    if (keys.length === 0) {
        return NextResponse.json(
            {
                error: "NO_API_KEYS",
                message:
                    "No YouTube API keys configured. Set YOUTUBE_API_KEY or YOUTUBE_API_KEY_1..N in .env.local.",
            },
            { status: 500 }
        );
    }

    // Auto-rotate toggle. Default ON. When OFF, use only the first key and
    // surface the first quota error as 429 immediately (no rotation).
    const autoRotate = parseBool(
        process.env.YOUTUBE_API_KEY_AUTO_ROTATE,
        true
    );
    const pool = autoRotate ? keys : keys.slice(0, 1);

    if (!autoRotate && keys.length > 1) {
        console.log(
            `[youtube/search] YOUTUBE_API_KEY_AUTO_ROTATE=false — using only the first key (${pool.length} of ${keys.length} pool members).`
        );
    }

    for (let i = 0; i < pool.length; i++) {
        const key = pool[i];
        const result = await callYouTube(query, key);

        if (result.ok) {
            return NextResponse.json(result.data, { status: 200 });
        }

        const { status, body } = result;

        // Only rotate on quota-class errors. Other failures (invalid key,
        // malformed request, 5xx, network) are terminal — return as-is so
        // we don't mask real bugs.
        if (!isQuotaError(body)) {
            return NextResponse.json(
                body ?? { error: "UPSTREAM_ERROR", status },
                { status: status || 500 }
            );
        }

        // Never log the key itself — only the pool position.
        console.warn(
            `[youtube/search] Key #${i + 1} of ${pool.length} hit a quota-class error. Rotating.`
        );
    }

    // Every key in the pool returned a quota error.
    return NextResponse.json(
        {
            error: "QUOTA_EXHAUSTED",
            message:
                "All configured YouTube API keys have exceeded their quota. Paste a direct YouTube link or Video ID to add a song.",
        },
        { status: 429 }
    );
}
