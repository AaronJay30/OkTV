import { NextRequest, NextResponse } from "next/server";
import { withRotatingKey } from "@/lib/youtube-rotating-key";
import { ENDPOINT_QUOTA_COSTS } from "@/lib/youtube-rotating-key-types";

/**
 * GET /api/youtube/search?q=<query>
 *
 * Proxies a YouTube Data API v3 `search.list` request with automatic
 * API-key rotation (see lib/youtube-rotating-key.ts). When every key in the
 * pool returns a quota-class error we respond with HTTP 429 and
 * `{ error: "QUOTA_EXHAUSTED" }`.
 *
 * Spec: specs/01-rotational-api-key.md
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const YOUTUBE_SEARCH_ENDPOINT =
    "https://www.googleapis.com/youtube/v3/search";

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

    const result = await withRotatingKey(async (apiKey) => {
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

        if (response.ok) {
            return { ok: true as const, data: body };
        }

        return { ok: false as const, status: response.status, body };
    }, ENDPOINT_QUOTA_COSTS.search); // search.list = 100 quota units per call

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
