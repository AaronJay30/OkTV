// Shared helper for server-side routes that call the YouTube Data API
// with automatic key rotation. Used by /api/youtube/search and
// /api/youtube/enrich.

const QUOTA_REASONS = new Set([
    "quotaExceeded",
    "rateLimitExceeded",
    "userRateLimitExceeded",
    "dailyLimitExceeded",
]);

/**
 * Parse a boolean env var. Default is `true` unless the value is
 * explicitly one of: "false", "0", "no", "off" (case-insensitive).
 * Empty string and missing var both fall back to the default.
 */
export function parseBool(
    value: string | undefined,
    defaultValue: boolean
): boolean {
    if (value === undefined || value === null) return defaultValue;
    const v = value.trim().toLowerCase();
    if (v === "") return defaultValue;
    if (v === "false" || v === "0" || v === "no" || v === "off") return false;
    return true;
}

/**
 * Parse `YOUTUBE_API_KEY_MAX_SLOTS`. Default 20, clamped to [1, 100].
 */
export function parseMaxSlots(value: string | undefined): number {
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
 * Load the configured API key pool.
 * Order: legacy YOUTUBE_API_KEY, then YOUTUBE_API_KEY_1..N where
 * N is `YOUTUBE_API_KEY_MAX_SLOTS` (default 20, max 100).
 */
export function loadApiKeys(): string[] {
    const keys: string[] = [];
    const legacy = process.env.YOUTUBE_API_KEY;
    if (legacy && legacy.trim()) {
        keys.push(legacy.trim());
    }
    const maxSlots = parseMaxSlots(process.env.YOUTUBE_API_KEY_MAX_SLOTS);
    for (let i = 1; i <= maxSlots; i++) {
        const k = process.env[`YOUTUBE_API_KEY_${i}`];
        if (k && k.trim()) {
            keys.push(k.trim());
        }
    }
    return Array.from(new Set(keys));
}

/** Returns true if the upstream error body looks like a quota-class failure. */
export function isQuotaError(payload: any): boolean {
    if (!payload || !Array.isArray(payload.error?.errors)) return false;
    return payload.error.errors.some((e: any) =>
        QUOTA_REASONS.has(e?.reason ?? "")
    );
}

type CallOutput<T> =
    | { ok: true; data: T }
    | { ok: false; status: number; body: any };

export type RotatingKeyResult<T> =
    | { ok: true; data: T }
    | { ok: false; status: number; body: any };

/**
 * Run `call(apiKey)` against the configured key pool. Returns the first
 * successful response, or `{ ok: false, status: 429, body: QUOTA_EXHAUSTED }`
 * when every key returns a quota-class error. Non-quota failures short-circuit
 * and return immediately.
 */
export async function withRotatingKey<T>(
    call: (apiKey: string) => Promise<CallOutput<T>>
): Promise<RotatingKeyResult<T>> {
    const keys = loadApiKeys();

    if (keys.length === 0) {
        return {
            ok: false,
            status: 500,
            body: {
                error: "NO_API_KEYS",
                message:
                    "No YouTube API keys configured. Set YOUTUBE_API_KEY or YOUTUBE_API_KEY_1..N in .env.local.",
            },
        };
    }

    const autoRotate = parseBool(
        process.env.YOUTUBE_API_KEY_AUTO_ROTATE,
        true
    );
    const pool = autoRotate ? keys : keys.slice(0, 1);

    if (!autoRotate && keys.length > 1) {
        console.log(
            `[youtube] YOUTUBE_API_KEY_AUTO_ROTATE=false — using only the first key (${pool.length} of ${keys.length} pool members).`
        );
    }

    for (let i = 0; i < pool.length; i++) {
        const key = pool[i];
        const result = await call(key);

        if (result.ok) {
            return { ok: true, data: result.data };
        }

        if (!isQuotaError(result.body)) {
            return { ok: false, status: result.status, body: result.body };
        }

        console.warn(
            `[youtube] Key #${i + 1} of ${pool.length} hit a quota-class error. Rotating.`
        );
    }

    return {
        ok: false,
        status: 429,
        body: {
            error: "QUOTA_EXHAUSTED",
            message:
                "All configured YouTube API keys have exceeded their quota. Paste a direct YouTube link or Video ID to add a song.",
        },
    };
}