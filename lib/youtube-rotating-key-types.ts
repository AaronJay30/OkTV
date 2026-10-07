// lib/youtube-rotating-key-types.ts
//
// Shared types for per-slot usage stats. Kept separate so the rotating
// helper can be loaded without pulling in RTDB (the admin API imports the
// same type for its response shape).

export interface KeySlotStats {
    /** Slot label: "legacy" for YOUTUBE_API_KEY, "1".."N" for numbered slots. */
    label: string;
    /** Last 4 chars of the API key, for display. */
    last4: string;
    /** Cumulative request count since process start. */
    totalRequests: number;
    /** Cumulative quota units consumed (sum of quotaCost per request). */
    totalUnits: number;
    /** Epoch-ms timestamps of requests in the last 24h (rolling). */
    recent: number[];
    /** Recent quota units grouped by request timestamp for hourly charts. */
    recentUnits?: Array<{ at: number; units: number }>;
    /** Last time the slot returned a quota-class error. null if never. */
    quotaExceededAt: number | null;
    hourly?: number[];
    /** Derived field added by readSlotStats(). Number of recent timestamps. */
    last24hRequests?: number;
}

export const YOUTUBE_DAILY_QUOTA_PER_KEY = 10_000;

/**
 * Default per-endpoint quota unit costs. YouTube Data API v3:
 *   - search.list: 100
 *   - videos.list: 1
 *   - channels.list: 1
 *   - playlistItems.list: 1
 *   - commentThreads.list: 1
 * Callers pass these explicitly via withRotatingKey(call, cost).
 */
export const ENDPOINT_QUOTA_COSTS = {
    search: 100,
    videos: 1,
    channels: 1,
    playlistItems: 1,
    commentThreads: 1,
} as const;
