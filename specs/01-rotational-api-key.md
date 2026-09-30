# Spec 1 — Rotational YouTube API Key Pool

**Status:** Draft (not implemented)
**Scope:** Backend only (`app/api/youtube/search/route.ts`)
**Out of scope:** Frontend changes (handled in `specs/02-custom-url-search.md`)

---

## 1. Problem

YouTube Data API v3 keys carry a daily quota (default 10,000 units; `search.list`
costs 100 units per call). A single key can be exhausted quickly when shared
across many users in karaoke rooms. Hitting `quotaExceeded` currently surfaces
to the user as a generic error and breaks the queueing flow.

## 2. Goal

Make the karaoke app resilient to per-key quota exhaustion by rotating through
a pool of keys transparently. Only when the **entire pool** is exhausted should
the user see an error — and even then, the error must guide them toward the
URL/ID bypass (handled by Spec 2).

## 3. Non-Goals

- No persistent caching of search results (separate feature).
- No analytics/telemetry on key usage.
- No automatic key provisioning (keys are static, configured via env).

## 4. Design

### 4.1 Environment Variables

Keys are loaded from `process.env`, kept **server-side only** (never bundled
into the client). Order of precedence:

1. `YOUTUBE_API_KEY` (legacy single key, kept for backwards compatibility)
2. `YOUTUBE_API_KEY_1`, `YOUTUBE_API_KEY_2`, …, `YOUTUBE_API_KEY_20`

Duplicates are removed; blanks are skipped. If zero keys are configured, the
route returns `500 { error: "NO_API_KEYS" }`.

### 4.2 Route Shape

- **Method:** `GET /api/youtube/search?q=<query>`
- **Runtime:** `nodejs`, `dynamic = "force-dynamic"` (never cache)
- **Upstream:** `https://www.googleapis.com/youtube/v3/search`
  - `part=snippet`, `maxResults=30`, `type=video`, `videoEmbeddable=true`
  - Appends `" karaoke"` to the user query (matches existing behavior in `lib/youtube.ts`)
- **Validation:** Missing/empty `q` → `400 { error: "MISSING_QUERY" }`

### 4.3 Rotation Algorithm

```
keys = loadApiKeys()                    // de-duplicated, server-only
if keys is empty: return 500 NO_API_KEYS

for key in keys:
    response = await GET(YOUTUBE_SEARCH_ENDPOINT + "&key=" + key)
    if response.ok:
        return 200 response.json()

    body = response.json()
    if not isQuotaError(body):
        // Non-quota error (e.g. bad key, invalid request). Terminal.
        return response.status + body

    console.warn("[youtube/search] Key #N exhausted, rotating")

// Pool exhausted
return 429 { error: "QUOTA_EXHAUSTED", message: "..." }
```

A response counts as a quota error when **any** item in `body.error.errors[]`
has a `reason` of one of:
- `quotaExceeded`
- `rateLimitExceeded`  ← **most common in practice** for the daily search cap
- `userRateLimitExceeded`
- `dailyLimitExceeded`

Non-quota failures (4xx other than the above, 5xx upstream) are **not** rotated
through — they are terminal and returned to the caller as-is. This prevents
masking real bugs (e.g. malformed query) by silently switching keys.

### 4.5 Real-World Error Sample

Observed in production. Top-level HTTP status is `429`, body wrapped in
`{ error: {...} }`, and the actionable signal lives at
`error.errors[0].reason`:

```json
{
  "error": {
    "code": 429,
    "message": "Quota exceeded for quota metric 'Search Queries' and limit 'Search Queries per day' of service 'youtube.googleapis.com' for consumer 'project_number:368441505633'.",
    "errors": [
      {
        "message": "...",
        "domain": "global",
        "reason": "rateLimitExceeded"
      }
    ],
    "status": "RESOURCE_EXHAUSTED",
    "details": [
      {
        "@type": "type.googleapis.com/google.rpc.ErrorInfo",
        "reason": "RATE_LIMIT_EXCEEDED",
        "domain": "googleapis.com",
        "metadata": {
          "quota_limit": "defaultSearchListPerDayPerProject",
          "quota_unit": "1/d/{project}",
          "service": "youtube.googleapis.com",
          "quota_metric": "youtube.googleapis.com/search_list",
          "consumer": "projects/368441505633",
          "quota_location": "global",
          "quota_limit_value": "0"
        }
      }
    ]
  }
}
```

**Decision rule:** trust `error.errors[*].reason` (the canonical gRPC-style
field). The top-level `code` (429) and `status` ("RESOURCE_EXHAUSTED") are
redundant. The `details[*]` block is purely informational and is **not** used
for routing.

This sample exercises the `rateLimitExceeded` branch of `isQuotaError` — the
most common shape for the daily search quota.

### 4.4 Response Contracts

| Status | Body shape                                | Meaning                              |
|--------|-------------------------------------------|--------------------------------------|
| 200    | `{ items: YouTubeSearchResult[], ... }`   | Success                              |
| 400    | `{ error: "MISSING_QUERY", message }`     | Empty `q`                            |
| 429    | `{ error: "QUOTA_EXHAUSTED", message }`   | Every key in pool is exhausted       |
| 500    | `{ error: "NO_API_KEYS", message }`       | Zero keys configured                 |
| 502    | `{ error: "UPSTREAM_FETCH_FAILED" }`      | Network failure to YouTube           |
| other  | upstream body (or `{ error, status }`)    | Terminal non-quota failure           |

The `429` body is the **only** error the client must specially handle — see
Spec 2 for how it surfaces in the UI.

## 5. Files Touched

- **New:** `app/api/youtube/search/route.ts`
- **Modified:** `lib/youtube.ts` (add `searchYouTubeViaApi()` wrapper + `YouTubeQuotaExceededError` class so the client has a typed signal)
- **Docs:** `README.md` — append a "YouTube API Key Rotation" section explaining the env vars

## 6. Acceptance Criteria

- `AC-ROT-1` Given `YOUTUBE_API_KEY_1` returns `quotaExceeded`, when a search
  hits the route, then the route retries with `YOUTUBE_API_KEY_2` and returns
  its result with status 200.
- `AC-ROT-2` Given all configured keys return `quotaExceeded`, the route
  returns `429 { error: "QUOTA_EXHAUSTED" }`.
- `AC-ROT-3` Given a key returns `403` with `reason: "keyInvalid"` (non-quota),
  the route returns the upstream `403` body **without** rotating.
- `AC-ROT-4` Given no keys are configured, the route returns
  `500 { error: "NO_API_KEYS" }` and logs a clear server-side error.
- `AC-ROT-5` Given `YOUTUBE_API_KEY` and `YOUTUBE_API_KEY_1` hold the same
  value, only one request is made (deduped pool).
- `AC-ROT-6` The client-side bundle contains no key strings (verified by
  searching the built `.next/` directory).
- `AC-ROT-7` An empty `q` returns `400 MISSING_QUERY` before any key is used.

## 7. Testing Strategy

- **Unit:** mock `fetch`, feed scripted responses, assert rotation order and
  final status.
- **Manual:** set one valid key + one fake key, observe successful request
  after the first key is mocked to fail with quotaExceeded.

## 8. Risks

- **Quota cost during testing:** every real call costs 100 units. Use a
  separate GCP project or rely on mocks for CI.
- **Key leakage via logs:** route must never log full keys. Current warning
  message uses index, not value — confirmed safe.
- **Concurrent requests racing on the same key:** each request independently
  iterates the pool. If key A is exhausted at request N but used at request
  N+1 by a concurrent user, YouTube will return `quotaExceeded` again and we
  rotate. Acceptable: worst case is one extra failed call before rotating.
- **Rotation only helps across separate GCP projects.** The production error
  shows `quota_limit_value: "0"`, meaning a key inside a project whose daily
  search quota is already zero will return `rateLimitExceeded` for every call
  until midnight. Rotation **only** saves you when at least one pool member
  lives in a project that still has remaining quota. **Operational
  requirement:** keys must be distributed across multiple GCP projects to
  realize any meaningful resilience — keys inside the same project share a
  single per-project quota pool.
