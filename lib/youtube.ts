// Replace the mock YouTube API client with a real implementation

// YouTube API client
// This uses the YouTube Data API v3

export interface YouTubeSearchResult {
    id: {
        videoId: string;
    };
    snippet: {
        title: string;
        description: string;
        thumbnails: {
            default: {
                url: string;
                width: number;
                height: number;
            };
            medium: {
                url: string;
                width: number;
                height: number;
            };
        };
        channelTitle: string;
        publishedAt: string;
    };
}

// Using environment variable for API key
// Make sure to add YOUTUBE_API_KEY to your .env.local file
const API_KEY = process.env.YOUTUBE_API_KEY || "YOUR_YOUTUBE_API_KEY";

export async function searchYouTube(
    query: string
): Promise<YouTubeSearchResult[]> {
    try {
        const response = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=30&q=${encodeURIComponent(
                query + " karaoke"
            )}&type=video&videoEmbeddable=true&key=${API_KEY}`
        );
        if (!response.ok) {
            console.error(`YouTube API error: ${response.status}`);
            throw new Error(`YouTube API error: ${response.status}`);
        }

        const data = await response.json();
        return data.items;
    } catch (error) {
        console.error("Error searching YouTube:", error);
        // Fallback to mock data if API fails
        return getMockSearchResults(query);
    }
}

// Mock data function for development or when API key is not available
function getMockSearchResults(query: string): YouTubeSearchResult[] {
    const allResults = [
        {
            id: { videoId: "dQw4w9WgXcQ" },
            snippet: {
                title: "Rick Astley - Never Gonna Give You Up (Karaoke Version)",
                description:
                    "Official karaoke version for Rick Astley - Never Gonna Give You Up",
                thumbnails: {
                    default: {
                        url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/default.jpg",
                        width: 120,
                        height: 90,
                    },
                    medium: {
                        url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
                        width: 320,
                        height: 180,
                    },
                    high: {
                        url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
                        width: 480,
                        height: 360,
                    },
                },
                channelTitle: "Karaoke Hits",
                publishedAt: "2019-10-25T06:57:33Z",
            },
        },
        {
            id: { videoId: "kJQP7kiw5Fk" },
            snippet: {
                title: "Luis Fonsi - Despacito ft. Daddy Yankee (Karaoke)",
                description: "Karaoke version of Despacito",
                thumbnails: {
                    default: {
                        url: "https://i.ytimg.com/vi/kJQP7kiw5Fk/default.jpg",
                        width: 120,
                        height: 90,
                    },
                    medium: {
                        url: "https://i.ytimg.com/vi/kJQP7kiw5Fk/mqdefault.jpg",
                        width: 320,
                        height: 180,
                    },
                    high: {
                        url: "https://i.ytimg.com/vi/kJQP7kiw5Fk/hqdefault.jpg",
                        width: 480,
                        height: 360,
                    },
                },
                channelTitle: "Karaoke World",
                publishedAt: "2017-06-12T15:00:53Z",
            },
        },
        {
            id: { videoId: "JGwWNGJdvx8" },
            snippet: {
                title: "Ed Sheeran - Shape of You (Karaoke Version)",
                description: "Sing along to Shape of You by Ed Sheeran",
                thumbnails: {
                    default: {
                        url: "https://i.ytimg.com/vi/JGwWNGJdvx8/default.jpg",
                        width: 120,
                        height: 90,
                    },
                    medium: {
                        url: "https://i.ytimg.com/vi/JGwWNGJdvx8/mqdefault.jpg",
                        width: 320,
                        height: 180,
                    },
                    high: {
                        url: "https://i.ytimg.com/vi/JGwWNGJdvx8/hqdefault.jpg",
                        width: 480,
                        height: 360,
                    },
                },
                channelTitle: "Karaoke Hits",
                publishedAt: "2017-03-30T05:00:01Z",
            },
        },
        {
            id: { videoId: "fJ9rUzIMcZQ" },
            snippet: {
                title: "Queen - Bohemian Rhapsody (Karaoke)",
                description: "Karaoke version of Queen's Bohemian Rhapsody",
                thumbnails: {
                    default: {
                        url: "https://i.ytimg.com/vi/fJ9rUzIMcZQ/default.jpg",
                        width: 120,
                        height: 90,
                    },
                    medium: {
                        url: "https://i.ytimg.com/vi/fJ9rUzIMcZQ/mqdefault.jpg",
                        width: 320,
                        height: 180,
                    },
                    high: {
                        url: "https://i.ytimg.com/vi/fJ9rUzIMcZQ/hqdefault.jpg",
                        width: 480,
                        height: 360,
                    },
                },
                channelTitle: "Karaoke Legends",
                publishedAt: "2018-05-15T12:30:00Z",
            },
        },
        {
            id: { videoId: "RgKAFK5djSk" },
            snippet: {
                title: "Wiz Khalifa - See You Again ft. Charlie Puth (Karaoke)",
                description: "Karaoke version of See You Again",
                thumbnails: {
                    default: {
                        url: "https://i.ytimg.com/vi/RgKAFK5djSk/default.jpg",
                        width: 120,
                        height: 90,
                    },
                    medium: {
                        url: "https://i.ytimg.com/vi/RgKAFK5djSk/mqdefault.jpg",
                        width: 320,
                        height: 180,
                    },
                    high: {
                        url: "https://i.ytimg.com/vi/RgKAFK5djSk/hqdefault.jpg",
                        width: 480,
                        height: 360,
                    },
                },
                channelTitle: "Karaoke World",
                publishedAt: "2017-04-10T14:20:00Z",
            },
        },
        {
            id: { videoId: "60ItHLz5WEA" },
            snippet: {
                title: "Alan Walker - Faded (Karaoke Version)",
                description: "Sing along to Faded by Alan Walker",
                thumbnails: {
                    default: {
                        url: "https://i.ytimg.com/vi/60ItHLz5WEA/default.jpg",
                        width: 120,
                        height: 90,
                    },
                    medium: {
                        url: "https://i.ytimg.com/vi/60ItHLz5WEA/mqdefault.jpg",
                        width: 320,
                        height: 180,
                    },
                    high: {
                        url: "https://i.ytimg.com/vi/60ItHLz5WEA/hqdefault.jpg",
                        width: 480,
                        height: 360,
                    },
                },
                channelTitle: "Karaoke Hits",
                publishedAt: "2018-02-20T09:15:00Z",
            },
        },
    ];

    // Filter results based on query
    if (query) {
        const lowerQuery = query.toLowerCase();
        const filteredResults = allResults.filter(
            (result) =>
                result.snippet.title.toLowerCase().includes(lowerQuery) ||
                result.snippet.description.toLowerCase().includes(lowerQuery)
        );
        // If no results found with the filter, return all mock results
        if (filteredResults.length === 0) {
            return allResults;
        }

        return filteredResults;
    }

    return allResults;
}

// =============================================================================
// Routed search (uses /api/youtube/search with key rotation + 429 handling)
// =============================================================================
//
// The server-side route at /api/youtube/search rotates through the configured
// API key pool. When every key is exhausted it returns HTTP 429 with body
// `{ error: "QUOTA_EXHAUSTED", message }`.
//
// `searchYouTubeViaApi` surfaces that case as a typed `YouTubeQuotaExceededError`
// so callers can show a user-friendly message instead of a generic failure.

export class YouTubeQuotaExceededError extends Error {
    constructor(message?: string) {
        super(message ?? "QUOTA_EXHAUSTED");
        this.name = "YouTubeQuotaExceededError";
    }
}

/**
 * Calls the server-side `/api/youtube/search` route. Throws
 * {@link YouTubeQuotaExceededError} when the pool is exhausted (HTTP 429).
 */
export async function searchYouTubeViaApi(
    query: string
): Promise<YouTubeSearchResult[]> {
    const url = `/api/youtube/search?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, { cache: "no-store" });

    if (response.status === 429) {
        throw new YouTubeQuotaExceededError();
    }

    if (!response.ok) {
        let detail = "";
        try {
            const body = await response.json();
            detail = body?.message || body?.error || "";
        } catch {
            // ignore — body wasn't JSON
        }
        throw new Error(
            `YouTube search failed (${response.status})${detail ? `: ${detail}` : ""}`
        );
    }

    const data = await response.json();
    return Array.isArray(data?.items)
        ? (data.items as YouTubeSearchResult[])
        : [];
}

// =============================================================================
// URL / Video ID parsing — quota-free bypass (Spec 2)
// =============================================================================
//
// Recognized URL shapes (single regex):
//   - https://www.youtube.com/watch?v=VIDEO_ID            (+ m. / music. subdomains)
//   - https://www.youtube.com/watch?v=VIDEO_ID&t=42s
//   - https://youtu.be/VIDEO_ID
//   - https://www.youtube.com/shorts/VIDEO_ID
//   - https://www.youtube.com/embed/VIDEO_ID
//   - https://www.youtube.com/v/VIDEO_ID
// Plus bare 11-character video IDs.

const YOUTUBE_VIDEO_ID_REGEX = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_URL_REGEX =
    /(?:https?:\/\/)?(?:www\.|m\.|music\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i;

export interface ExtractedYouTubeId {
    videoId: string;
    source: "url" | "bare-id";
}

export function extractYouTubeVideoId(
    input: string
): ExtractedYouTubeId | null {
    if (!input) return null;
    const trimmed = input.trim();
    if (!trimmed) return null;

    const urlMatch = trimmed.match(YOUTUBE_URL_REGEX);
    if (urlMatch && urlMatch[1]) {
        return { videoId: urlMatch[1], source: "url" };
    }

    if (YOUTUBE_VIDEO_ID_REGEX.test(trimmed)) {
        return { videoId: trimmed, source: "bare-id" };
    }

    return null;
}

export function buildYouTubeThumbnail(videoId: string): string {
    return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

export interface BypassPreview {
    videoId: string;
    title: string;
    thumbnail: string;
    channel?: string;
    duration?: string;
    isEnriching: boolean;
    enrichmentFailed?: boolean;
}

export interface YouTubeEnrichmentItem {
    id: string;
    title: string;
    channel: string;
    thumbnail: string;
    duration?: string;
}

/**
 * Best-effort metadata enrichment via /api/youtube/enrich. Never throws —
 * returns `[]` on any failure (HTTP 429 quota, network error, malformed
 * response, non-2xx status). Callers should treat empty results as
 * "enrichment unavailable" and fall back to the generic title.
 *
 * Spec: specs/02-custom-url-search.md §4.5
 */
export async function enrichYouTubeIds(
    ids: string[]
): Promise<YouTubeEnrichmentItem[]> {
    if (ids.length === 0) return [];
    try {
        const url = `/api/youtube/enrich?ids=${encodeURIComponent(
            ids.join(",")
        )}`;
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) return [];
        const data = await response.json();
        return Array.isArray(data?.items) ? data.items : [];
    } catch {
        return [];
    }
}

/** Title used when enrichment is unavailable or in flight. */
export function genericBypassTitle(videoId: string): string {
    return `YouTube video (${videoId})`;
}
