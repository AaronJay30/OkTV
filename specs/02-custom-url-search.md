# Spec 2 — Custom URL / Video ID Search (Quota-Free Bypass)

**Status:** Draft (not implemented)
**Scope:** Frontend (`app/room/[id]/page.tsx`, `lib/youtube.ts`)
**Depends on:** `specs/01-rotational-api-key.md` (for the 429 contract)

---

## 1. Problem

When the YouTube API quota is exhausted (Spec 1 returns `429 QUOTA_EXHAUSTED`)
the user is locked out of adding **any** song, even ones they already know
the URL for. Forcing every queued song through `search.list` is wasteful:
YouTube URLs and bare 11-character video IDs uniquely identify a track and
require no API call.

## 2. Goal

Let users queue a song without consuming search quota in two cases:

1. They paste a YouTube URL into the search bar.
2. They paste a bare 11-character YouTube Video ID.

When the search route returns `429 QUOTA_EXHAUSTED`, guide users to the URL
bypass via a persistent, dismissable message — not just a fleeting toast.

## 3. Non-Goals

- No in-browser caching of search results (separate feature).
- No support for YouTube Music URLs (excluded deliberately; mobile app
  behavior differs and metadata is harder to synthesize).

### 3.1 Title enrichment (best-effort, NOT a non-goal)

URL-bypassed songs **may** show a real title when the API is healthy. The
bypass route will call `videos.list` (1 quota unit per call) *only* as a
best-effort step:

- On success, the queued song shows the real title and a richer thumbnail
  (`maxres` if available, else `hqdefault`).
- On any error (quota, network, invalid id, parse failure), the song falls
  back to the generic title `"YouTube video (<id>)"` with the `hqdefault`
  thumbnail. **Never fails the bypass because of enrichment.**

This means a healthy-key user gets a polished experience while a
quota-exhausted user still gets a working bypass — same code path.

## 4. Design

### 4.1 URL / ID Parsing

A pure function `extractYouTubeVideoId(input: string)` in `lib/youtube.ts`
returns `{ videoId, source: "url" | "bare-id" } | null`.

Recognized URL shapes (single regex):
- `https://www.youtube.com/watch?v=<id>` (and `m.`, `music.` subdomains)
- `https://youtu.be/<id>`
- `https://www.youtube.com/shorts/<id>`
- `https://www.youtube.com/embed/<id>`
- `https://www.youtube.com/v/<id>`
- Trailing query strings (`&t=42s`, `&list=...`) are ignored.

Bare ID match: `^[A-Za-z0-9_-]{11}$` (standard YouTube ID charset/length).

A helper `buildYouTubeThumbnail(videoId)` returns
`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`.

### 4.2 Two Entry Points

The bypass is exposed in **two places** so it's discoverable regardless of
whether the user is reading the search bar or stuck on a quota error:

| Entry point | Trigger                                  | Where it lives                          |
|-------------|------------------------------------------|------------------------------------------|
| Search bar  | User pastes URL/ID and presses Enter     | Inline — detected inside `handleSearch` |
| Paste Link modal | User clicks the dedicated `Link` button next to the search input | `Dialog` opened from the search tab |

Both paths run the same parser, build the same `Song` payload, and call the
same `addSongToQueue` helper — no API call is made either way.

### 4.3 Modal: "Paste Link" Dialog (preview-then-add)

A new icon button (`Link2` from `lucide-react`) sits immediately to the
right of the existing search `Button`. It opens a `Dialog` containing:

- A `Label` + `Input` for pasting a URL or video ID.
- A short helper text: "Paste any YouTube link or 11-character Video ID."
- An **inline preview card** that appears as soon as the input is
  validated — even before the user clicks "Add to Queue". See §4.6.
- An "Add to Queue" primary button. Disabled until input parses successfully.
- A "Cancel" button (or Esc / click-outside to dismiss).
- Inline validation message on bad input (red text below the input).

On submit:
1. The preview card is already populated (§4.6).
2. `addSongToQueue(roomId, previewSong)`.
3. Close modal, clear input, clear preview, show success toast, switch
   active tab to `"queue"`.

### 4.4 Search-Bar Inline Bypass (preview-then-add)

`handleSearch` is updated as follows:

1. If `searchQuery.trim()` matches a URL/ID → **don't auto-add**. Instead:
   - Extract the ID.
   - Fire the same preview-card render (§4.6) directly in the search
     results list, so the user sees thumbnail + title + "Add to Queue"
     button.
   - **Do not** call the API. The preview uses the generic title
     (`"YouTube video (<id>)"`) until enrichment completes.
   - Fire best-effort `videos.list` enrichment in the background; on
     success, swap the preview card to show the real title.
   - Return early — do not populate `searchResults`.
2. Else call `searchYouTubeViaApi(query)` (the Spec 1 wrapper). Behavior
   identical to today.
3. If response throws `YouTubeQuotaExceededError`:
   - Show destructive toast: **"Daily search limit reached. Paste a direct
     YouTube link or Video ID to add your song!"** (8-second duration).
   - Set `searchResults` to `[]` so the previous list is cleared.
4. Other errors → existing "Search Error" toast.

### 4.5 Preview Card (shared by both entry points)

The preview card renders inside the existing `ScrollArea` (search-bar path)
or inside the dialog body (modal path). Same component, same data shape:

```
┌───────────────────────────────────────────────────────────┐
│ [thumbnail 120x68]  Title (or "YouTube video (<id>)")    │
│                     Channel · 3:42                         │
│                                          [ Add to Queue ] │
└───────────────────────────────────────────────────────────┘
```

Data shape (TS):

```ts
interface BypassPreview {
    videoId: string;
    title: string;        // generic OR enriched; never empty
    thumbnail: string;    // always https://img.youtube.com/vi/<id>/hqdefault.jpg
    channel?: string;     // present only after enrichment
    duration?: string;    // present only after enrichment
    isEnriching: boolean; // true while videos.list is in flight
    enrichmentFailed?: boolean; // true if videos.list errored
}
```

Initial render uses `isEnriching: true, title: "YouTube video (<id>)"`. On
enrichment success → title/channel/duration populated, `isEnriching: false`.
On enrichment failure → unchanged except `isEnriching: false` and
`enrichmentFailed: true`. Either way the "Add to Queue" button is enabled
immediately on first render — **never blocked by the API**.

### 4.6 Song Payload at Queue Time

When the user clicks "Add to Queue" from the preview card:

```ts
const finalSong: Song = {
    id: preview.videoId,
    title: preview.title,                  // enriched if available
    thumbnail: preview.thumbnail,
    addedBy: userName,
};
```

If enrichment has not yet completed by the time the user clicks, the song
goes in with the generic title and is **not** re-fetched. Users who care
about the real title will see it once enrichment finishes a moment later
(spinner → real text). Users who don't care just click faster than the
network round-trip.

## 5. Files Touched

- **New:** `app/api/youtube/enrich/route.ts`
  - `GET /api/youtube/enrich?ids=<id1>,<id2>,...`
  - Calls `videos.list?part=snippet,contentDetails&id=<ids>` with the same
    key-rotation pool from Spec 1.
  - Returns `{ items: [{ id, title, channel, thumbnail, duration }, ...] }`
    on success, `429 { error: "QUOTA_EXHAUSTED" }` if pool is exhausted,
    `200 { items: [] }` if videos.list succeeded but found nothing
    (the client treats this as "enrichment unavailable" and falls back to
    the generic title).
  - Accepts up to 50 IDs per call (YouTube's hard limit).
- **Modified:** `lib/youtube.ts`
  - Add `extractYouTubeVideoId(input): { videoId, source } | null`
  - Add `buildYouTubeThumbnail(videoId)`
  - Add `BypassPreview` type
  - Add `enrichYouTubeIds(ids[]): Promise<Enrichment[]>` wrapper
  - Keep `searchYouTubeViaApi` and `YouTubeQuotaExceededError` from Spec 1
- **Modified:** `app/room/[id]/page.tsx`
  - Switch `handleSearch` from `searchYouTube` → `searchYouTubeViaApi`
  - Replace `handleSearch`'s "auto-add on URL" branch with the preview-card
    render path
  - Add `<BypassPreviewCard>` component (or inline equivalent) used by
    both the search bar and the dialog
  - Add `Link2` icon button + `Dialog` block for the Paste Link entry point
  - Update 429 error toast to point at the preview card / dialog
  - Replace the now-unused `searchYouTube` import path
- **No backend changes to `/api/youtube/search`** — Spec 1 stays untouched.

## 6. Acceptance Criteria

### URL / ID parsing
- `AC-URL-1` `extractYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")`
  returns `{ videoId: "dQw4w9WgXcQ", source: "url" }`.
- `AC-URL-2` `extractYouTubeVideoId("dQw4w9WgXcQ")` returns
  `{ videoId: "dQw4w9WgXcQ", source: "bare-id" }`.
- `AC-URL-3` `extractYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ?t=42")`
  extracts the ID and ignores `?t=42`.
- `AC-URL-4` `extractYouTubeVideoId("https://www.youtube.com/shorts/abcDEFGhiJK")`
  returns `{ videoId: "abcDEFGhiJK", source: "url" }`.
- `AC-URL-5` `extractYouTubeVideoId("not a youtube link")` returns `null`.

### Preview card behavior (search bar path)
- `AC-URL-6` Pasting a URL into the search bar and pressing Enter renders
  the preview card inside the search results area. **No song is added yet.**
- `AC-URL-7` The preview card shows `https://img.youtube.com/vi/<id>/hqdefault.jpg`
  as its thumbnail, `"YouTube video (<id>)"` as the title, and an enabled
  "Add to Queue" button. The "Add to Queue" button is enabled **before**
  enrichment completes.
- `AC-URL-8` On first render, a `/api/youtube/enrich?ids=<id>` request
  fires in the background. On success, the preview title and channel swap
  to the real values; on failure or 429, the generic title stays.
- `AC-URL-9` Clicking the preview's "Add to Queue" button calls
  `addSongToQueue`, clears the search input, removes the preview card,
  and switches the active tab to `"queue"`. **No** network call to
  `/api/youtube/search` is made at any point.

### Paste Link dialog
- `AC-URL-10` Clicking the "Paste Link" icon button opens the dialog. The
  dialog contains an input + a "Add to Queue" button (disabled while
  empty) + a preview card area (hidden until the input is valid).
- `AC-URL-11` Typing `not a youtube link` shows an inline red validation
  error and the "Add to Queue" button stays disabled.
- `AC-URL-12` Pasting `dQw4w9WgXcQ` enables the preview card and the
  "Add to Queue" button. Submitting closes the modal, clears the input,
  queues the song, and shows a success toast.
- `AC-URL-13` Esc and click-outside both close the dialog without
  queueing. Tab cycles input → "Add to Queue" → "Cancel".

### Quota handling
- `AC-URL-14` When the search route returns `429 QUOTA_EXHAUSTED`, the
  user sees a destructive toast whose description contains the exact
  string "Paste a direct YouTube link or Video ID" and `searchResults`
  is cleared.
- `AC-URL-15` The dialog and preview card paths work **even when the
  search quota is fully exhausted**, because they bypass `search.list`
  entirely. `videos.list` enrichment may fail and the generic title is
  used — that's fine.

### Free-text search
- `AC-URL-16` Free-text queries (e.g. `"bohemian rhapsody"`) still call
  `/api/youtube/search` and populate `searchResults` exactly as before.
  No preview card is shown for free-text queries.

### Backend enrichment route
- `AC-URL-17` `GET /api/youtube/enrich?ids=A,B,C` with all three IDs
  existing returns `{ items: [{ id, title, channel, thumbnail, duration }, ...] }`
  with 200 OK.
- `AC-URL-18` With the key pool exhausted, returns
  `429 { error: "QUOTA_EXHAUSTED" }` and the client falls back to the
  generic title.
- `AC-URL-19` Empty/missing `ids` returns `400 { error: "MISSING_IDS" }`
  before any key is consumed.
- `AC-URL-20` More than 50 IDs returns `400 { error: "TOO_MANY_IDS", max: 50 }`.

## 7. Testing Strategy

- **Unit:** `extractYouTubeVideoId` table-driven tests across all URL
  shapes and invalid inputs.
- **Unit:** `parseIso8601Duration("PT3M42S")` → `"3:42"`.
- **Manual:** healthy key → paste URL → see real title appear after
  ~500ms in the preview card. Quota-exhausted key → paste URL → see
  generic title, queue still works.
- **Manual:** click "Paste Link" → paste valid URL → click "Add to Queue" →
  verify queue.

## 8. Risks

- **Race condition (preview card spam):** if the user pastes URLs faster
  than enrichment resolves, only the latest preview card is shown. We
  guard with a request-id token in client state; stale responses are
  dropped.
- **Invalid IDs:** if the ID doesn't exist on YouTube, the player will
  fail to load — no client-side validation exists. Out of scope.
- **Quota cost of enrichment:** 1 unit per `videos.list` call (50 IDs per
  call). Worst case for a quota-exhausted project: bypass still works
  with generic titles.
- **Modal focus traps:** Shadcn's `Dialog` already handles focus trapping
  via Radix — no custom logic required.
- **`videos.list` privacy:** the request reveals the user's IP + video IDs
  to Google. Acceptable since `youtube.com/vi/<id>/hqdefault.jpg`
  thumbnails already do the same.
