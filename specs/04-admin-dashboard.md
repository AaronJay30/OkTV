# Spec 4 — Admin Dashboard (Secret URL, Feature Flags, Key Pool, Room Management)

**Status:** Draft (not implemented)
**Scope:** Backend + frontend (`app/admin/*`, `app/api/admin/*`, `lib/*`, Firebase RTDB)
**Related:** Spec 1 (rotational key pool), `lib/youtube-rotating-key.ts`, `lib/firebase-service.ts`

---

## 1. Problem

The app has no operational control surface. Today:

- **Feature toggles** (`micFeatureEnabled`, `scorerEnabled` in `createRoom`) are per-room
  defaults plumbed through code, but cannot be toggled globally without a redeploy.
- **API key pool** lives in env vars. Adding a key after quota exhaustion requires a
  rebuild/redeploy — precisely when you least want to do that.
- **No visibility** into which key is burning quota, or which rooms/users are active.
- **Room cleanup** is a blunt 1-day auto-delete with no way to inspect or selectively
  delete rooms that are bloating the database.

## 2. Goal

A password-protected admin area at a secret path that provides:

1. Real session auth (HttpOnly signed cookie, bcrypt-hashed password in env).
2. Per-API-key usage/quota stats.
3. Global feature flags: phone-as-mic, karaoke scorer, create-room modal visibility.
4. Room browser with per-room delete.
5. Runtime key pool management (add/remove keys in RTDB, no redeploy).

## 3. Non-Goals

- Multi-admin / user management. Single admin via env.
- Full analytics or charts. Tables only.
- Client-side "hidden route" security theater. The secret path is convenience, not
  the security boundary — the cookie session is.

## 4. Auth Design

### 4.1 Password storage

- `ADMIN_PASSWORD_HASH` env var: a **bcrypt** hash (cost 10–12), generated offline:
  ```bash
  pnpm dlx bcryptjs  # or use a one-liner node script (see §9)
  ```
- Login flow: user POSTs the **raw password**; the server compares
  `bcrypt.compare(raw, process.env.ADMIN_PASSWORD_HASH)`. This is exactly the
  "type raw password, hash-compare against env" model discussed.
- Plaintext comparison is rejected. If `ADMIN_PASSWORD_HASH` is missing, all admin
  routes return `503 ADMIN_NOT_CONFIGURED` (fail closed).

### 4.2 Session

- On success, set an **HttpOnly, Secure (prod only), SameSite=Strict** cookie
  `oktv_admin` containing a signed token: `HMAC-SHA256(payload, ADMIN_SESSION_SECRET)`.
  Payload: `{ exp: number }` (24h expiry, approved). No user id needed (single admin).
- `ADMIN_SESSION_SECRET`: separate random env var (32+ bytes, base64).
- Verified in each admin API route via a shared `requireAdmin()` helper
  (`lib/admin-auth.ts`). Check order: path match → cookie present →
  HMAC recomputed with **constant-time compare** → expiry → CSRF (mutations).
  Any failure returns **404**, never 401/403 (per §4.3).
- Rate limiting runs **before** bcrypt on login: in-memory
  `{ [ip]: timestamps[] }`, 5 attempts / 60s → `429`; rejected attempts
  never reach bcrypt. Single-instance only; documented limitation.
- bcrypt cost factor: **11** (~100ms/verify).
- `Secure` flag is `NODE_ENV === "production"` so localhost dev works —
  must be noted in setup docs.
- Logout clears both cookies client-side; tokens are not server-revoked
  (self-validating HMAC, 24h hard expiry). No JWT, no session store.

### 4.3 Secret path (bot-noise layer)

The secret path is a **defense-in-depth convenience**, not a security control.
Its job is to reduce bot noise and accidental discovery; the real security is
Layer 3 (the bcrypt + cookie session).

- **Configurable path segment:** `ADMIN_PATH_SLICE` env var. The default is
  intentionally **not** `admin` — pick something non-obvious like
  `console-7f3k`, or fail-fast at boot if the env var is missing. The point
  is to not publish a guessable default.
- **API routes are also gated by the path.** Only `app/[adminPath]/...` and
  the matching `app/api/admin/...` routes are valid. Any other admin-shaped
  request (`/admin`, `/administrator`, etc.) gets `404`.
- **Mismatched / unauthenticated responses must be `404`, not `401`/`403`.**
  Returning 401/403 confirms a path exists and invites further probing. A
  404 is indistinguishable from "no such page."
- **Session check happens first, then path check.** This ordering
  intentionally leaks nothing about whether a path was even real.
- Rate limit login: 5 attempts / minute / IP (in-memory counter is fine for a
  single-instance deployment; note the limitation in docs).

### 4.4 CSRF

All mutating admin endpoints require the `X-Admin-CSRF` header, echoed from a
non-HttpOnly `oktv_csrf` cookie set at login (double-submit pattern).
SameSite=Strict already covers most cases; the header check is
defense-in-depth for older browsers.

### 4.5 Locked auth parameters (approved)

| Parameter | Value |
|-----------|-------|
| Session expiry | 24h |
| Rate limit | 5 attempts / 60s / IP, checked before bcrypt |
| bcrypt cost | 11 |
| Admin model | Single admin (env hash); multi-admin deferred |

## 5. RTDB Schema Additions

```
config/
  flags/
    phoneMicEnabled: boolean      // default true
    scorerEnabled: boolean        // default true
  keyStats/
    <slot>:                       // e.g. "1", "2", ... "legacy"
      last4: string               // masked key tail for display
      totalRequests: number       // cumulative requests
      last24h: number
      quotaExceededAt: ISO string | null
  auditLog/
    <pushId>:
      at: ISO string
      action: string              // e.g. "flag.update", "room.delete", "key.add"
      detail: object
```

## 6. Key Pool (env-only, stats in RTDB)

**Decision:** keys remain in env. Secrets stay on the server, never in a
cloud DB. With `YOUTUBE_API_KEY_MAX_SLOTS=20` (max 100), 20 pre-loaded keys
give ~200k searches/day headroom — quota exhaustion should not be a real
operational concern.

- Key loading order is Spec 1 unchanged: legacy `YOUTUBE_API_KEY`, then
  `YOUTUBE_API_KEY_1..N`.
- Counters track **quota units, not raw requests** (search=100, videos=1,
  etc. — constant lookup at increment time, since the rotating-key helper
  knows which route called it). "Today / 10,000" is the actionable number.
- Counters track a **rolling 24h window** as epoch-ms timestamps so the UI
  can derive both "last 24h" and an hourly histogram for charts.
- `lib/youtube-rotating-key.ts` is extended to track per-slot stats in
  process memory and persist a snapshot to RTDB `config/keyStats/<slot>`
  periodically (every ~60s). On boot, re-seed totals from RTDB so restarts
  don't zero the counters.
- The persisted snapshot is what the admin UI reads (via `onValue`
  subscription — live updates, no polling). Only masked tails
  (`AIzaSy…abcd`) leave the server — full keys never appear in RTDB or in
  any admin API response.
- A "quota resets at midnight Pacific" countdown is derived client-side.
- If you actually exhaust 20 keys in production, the right response is to
  add more env vars and redeploy — not to migrate to RTDB and accept the
  security tradeoff for an operational scenario that won't recur.

## 7. Feature Flag Enforcement

- **Flags live in RTDB at `config/flags`** (no env involvement — fully
  runtime-editable via admin). Defaults are permissive (all on) if
  `config/flags` is absent, so the app works identically before any admin
  ever visits the dashboard.
- **Two real flags:** `phoneMicEnabled` and `scorerEnabled`. The
  create-room modal is **not a flag** — it's derived: shown when at
  least one feature is on, skipped when both are off. (Originally
  specced as a third manual toggle; dropped because the derived rule
  covers every case anyone actually wanted.)
- **Client hides the UI reactively.** A small `hooks/use-flags.ts`
  subscribes to `config/flags` via `onValue`; components
  (`room-service`, `high-scores`, the create-room flow) read flags
  and skip rendering or short-circuit their flows when off.
- **Server-side enforcement at the data path** — this matters because
  client hiding alone is cosmetic. Since `firebase-service.ts` writes
  directly client→RTDB (no Next.js API layer), enforcement happens at
  the **RTDB security rules** level:
  - `scorerEnabled` off → rules deny writes to `rooms/{id}/scores`.
  - `phoneMicEnabled` off → rules deny writes to `rooms/{id}/micSignal`.
- **Skip-modal + per-feature hide behavior:** when a user clicks
  "Create Room":
  - If **both** feature flags are off → modal is skipped entirely,
    room is created with all features disabled.
  - If **at least one** feature flag is on → modal opens, showing
    switches only for the admin-enabled features. Admin-disabled
    features are hidden (not greyed out) — the user can only
    configure what the admin has allowed.

### 7.1 RTDB rules gap (known limitation)

The original spec said flag writes would be "enforced by RTDB rules."
That's wrong as written — **RTDB rules can only see Firebase Auth
context (`auth.uid`, custom claims), not custom HMAC cookies**. There is
no rule expression that says "allow write if the oktv_admin HMAC cookie
is valid." So the admin API's auth check passes, then Firebase refuses
the write.

**Workaround (in place now):** in Firebase Console → Realtime Database →
Rules, allow writes to `/config/flags`:

```json
{
  "rules": {
    "config": {
      ".read": "auth != null",
      "flags": {
        ".write": true
      }
    },
    "rooms": { ... }
  }
}
```

**Tradeoff:** any unauthenticated client with your database URL can
flip the flags. The secret admin path + HMAC cookie still protect the
admin UI, but RTDB is a public-readable DB so writes are not gated.
For a single-admin hobby app this is acceptable; the worst-case attack
is "someone disables features on your app for a few minutes."

**Proper fix (deferred — option C in design):** add Firebase Admin SDK
+ service account credentials. Admin SDK bypasses rules entirely (it
authenticates as the project's service account, not as a client).
Implementation needs `FIREBASE_SERVICE_ACCOUNT_JSON` env var with the
service-account key file content, plus replacing `rtdb` imports in
admin routes with `admin.database()`. Real work — needs ~30 min of
careful implementation + .env updates + spec amendments.

This gap is the most important thing on the "follow-up" list for this
slice.

## 8. Admin UI (multi-page, one feature per page)

Layout: `app/[adminPath]/` with a shared sidebar/tab nav. Each discussed
feature is its own page:

| Page | Route (under admin path) | Contents |
|------|--------------------------|----------|
| Login | `/` (gate) | Password field, error shake, no username |
| Features | `/features` | Card list of feature flags (see below) |
| Keys | `/keys` | Usage stats — table **and charts** (see below) |
| Rooms | `/rooms` | Room table + delete + purge-old button |
| Audit | `/audit` | Last 50 entries, newest first |

**Post-login landing:** after successful auth, the layout redirects
`/` to `/keys` (analytics is the primary operational view).

### Features page detail

Two cards (phone mic, scorer). The create-room modal is not a manual
toggle — see §7.

- **Card layout (asymmetric):**
  - Left ~20% width: feature icon (lucide-react: `Mic2` for phone-as-mic,
    `Star` for scorer).
  - Right ~80% width: feature name (top) + one-line description (below).
  - Top-right of card: a radio-style enabled/disabled indicator
    (filled dot = enabled, hollow dot = disabled, plus label text).
  - Clicking anywhere on the card toggles the flag.
- **Search box** at the top of the page filters cards by name or
  description. Free to keep; cheap.
- **Add-a-feature affordance** is intentionally absent — features are
  defined in code, not via the admin UI. Adding a feature is a code
  change.

### Keys page detail

- **Table:** slot, masked tail, 24h units, today/10,000, status
  (active / ⚠️ >80% / exceeded), last exhaustion timestamp, thin
  progress bar per row (a `div` with percentage width — no chart lib).
- **Charts** (using existing `components/ui/chart.tsx` / recharts):
  - Line chart: quota units per hour, last 24h, one series per key slot.
  - Bar chart (optional v1.1): today's units per slot, side by side.
- **Countdown:** "Quota resets at midnight Pacific — in Xh Ym".
- No add/remove UI — keys are managed in env.

**Implementation status (v1):** ships with table + progress bar +
status indicator + reset countdown. The hourly line chart was
**deferred** — `recent: number[]` is already exposed by
`readSlotStats()`, so wiring a recharts line chart later is a small
follow-up. RTDB snapshot persistence is also deferred (counters reset
on server restart; documented on the empty state).

### Rooms page detail

**Layout: list of collapsible room cards, single-open accordion.**
Not a traditional table. Each card represents one room; click the card
to expand it and see users, queue, and scores. Only one card is open at
a time so the page stays scannable.

**Card collapsed (header always visible):**
- Room ID (truncated, copyable)
- Created-at ("3h ago")
- Live user count (matches `users/` count)
- Current song title (or "—" if nothing playing)
- Right side: per-row **Delete** button + a small **checkbox** for
  multi-select

**Card expanded (click anywhere on the header):**
- **Users section** — list of `users/{userId}` with name, joined-at,
  mic state (active/inactive via `micSignal/` presence), last-seen.
- **Queue section** — ordered list of `queue/` entries: currently
  playing at top, next-up below.
- **Scores section** — table: user, song, score, timestamp; sorted
  newest first. Hidden if `scorerEnabled` is off (the section
  collapses to a "Scorer is disabled" message).
- **Delete button** (also here, not only in the header) — same action.

**Refresh model:** **live by default via `onValue` on `rooms/`** (same
pattern as existing room pages), **plus a manual refresh button** as
an escape hatch for when data shifts mid-click. Live updates are
silent; manual refresh is a button click that briefly shows a
loading indicator.

**Multi-select delete:**
- Each card's header has a checkbox.
- Selecting N cards reveals a sticky action bar at the bottom: "Delete
  N rooms" with a confirm dialog (per-room confirm gets tedious; one
  confirm with the room ID list is enough).

**Bulk purge:**
- "Purge rooms idle > N hours" button at the top.
- Idleness = `last_activity` newer threshold (NOT just `createdAt`).
- This requires a small amendment to `cleanupOldRooms` in
  `lib/firebase-service.ts`: compute `last_activity` per room as the
  newest `lastSeen` across users (fallback `createdAt`) and filter on
  that. Existing 1-day auto-cleanup stays; admin purge is a manual
  override.

**No "View room detail page"** — the expanded card IS the detail view.
No separate `/rooms/[id]` route.

**No kick-user / remove-song controls** — moderation lives in the room
UI itself (`room-service.tsx`). Admin dashboard is read + delete only.

### Charts data source

The hourly histogram is derived server-side from the rolling timestamp
window and persisted alongside the snapshot in RTDB
(`config/keyStats/<slot>/hourly` — 24 buckets), so the chart renders from
one read with no client-side bucketing.

## 9. Operational Notes

- Generating the password hash (one-time setup):
  ```bash
  node -e "console.log(require('bcryptjs').hashSync(process.argv[1], 11))" 'YOUR_PASSWORD'
  ```
- Generating the session secret:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  ```
- `.env.example` gains: `ADMIN_PASSWORD_HASH`, `ADMIN_SESSION_SECRET`,
  `ADMIN_PATH_SLICE` (with the two generation commands above inlined as
  comments).

### 9.1 Env var behavior (locked)

| Var | Missing behavior | Default |
|-----|------------------|---------|
| `ADMIN_PASSWORD_HASH` | 503 `ADMIN_NOT_CONFIGURED` on first admin-path request | none (required for admin) |
| `ADMIN_SESSION_SECRET` | 503 `ADMIN_NOT_CONFIGURED` on first admin-path request | none (required for admin) |
| `ADMIN_PATH_SLICE` | falls back to hardcoded non-obvious path | `console-0724` (override via env) |

- **Lazy fail, not boot fail.** The karaoke app must run fine without
  any admin vars — a forgotten deploy var must not take down the app
  for a feature nobody's using. Admin errors are surfaced on the admin
  path only.
- **Path slice default is non-obvious.** `console-0724` is memorable
  to the owner and bots-scraping to a non-guessable path. Rotating it
  is a one-line env change. Per §4.3, it's a still-better bot-noise
  layer, not the security boundary.
- **Boot log line** on startup (non-fatal): `Admin configured: yes/no
  (path=...)` so missing config is obvious in container logs without
  breaking anything.

### 9.2 Other ops

- Deleting a room via admin performs the same cleanup as `cleanupOldRooms`
  but targeted, plus writes an audit entry.

## 10. Additional Features Considered (and disposition)

| Idea | Verdict |
|------|---------|
| Active user presence counts | Accept — cheap, derived from existing RTDB `users/` nodes |
| Manual "purge all old rooms" button | Accept — reuses `cleanupOldRooms(n)` |
| Charts/graphs of usage over time | Accept — already have shadcn/recharts in `components/ui/chart.tsx` |
| Multiple admin accounts | Defer — single admin is enough |
| Editing room queues / kicking users | Reject — scope creep, room page already has controls |
| Per-key remaining quota query | Reject — costs quota to check; show exhaustion timestamps only |
| Announcements banner to all rooms | Defer — nice-to-have, not in v1 |
| Runtime key add/remove via RTDB | Rejected — pre-provision via env (max 100 slots); secrets stay off the DB |
| Maintenance mode / "system maintenance" page | Rejected — no user sessions exist to gate; RTDB-connected rooms can't be interrupted via a redirect; achievable in 30s with `docker compose stop` or edge-level maintenance page. Revisit only if a scenario appears that deploy controls can't cover |

## 11. File Plan (for implementation later)

```
lib/admin-auth.ts                    — HMAC session verify, requireAdmin()
app/[adminPath]/layout.tsx           — shared nav + login gate
app/[adminPath]/page.tsx             — overview / redirect to first section
app/[adminPath]/flags/page.tsx
app/[adminPath]/keys/page.tsx        — table + charts
app/[adminPath]/rooms/page.tsx
app/[adminPath]/audit/page.tsx
app/api/admin/login/route.ts         — POST (rate-limited)
app/api/admin/logout/route.ts        — POST
app/api/admin/flags/route.ts         — GET/PUT
app/api/admin/keys/route.ts          — GET masked stats + hourly buckets
app/api/admin/rooms/route.ts         — GET
app/api/admin/rooms/[roomId]/route.ts— DELETE
app/api/admin/audit/route.ts         — GET
hooks/use-flags.ts                   — client flag subscription
components/admin/*                   — section components
```

### 11.1 Implementation status

| File | Status | Notes |
|------|--------|-------|
| `lib/admin-auth.ts` | ✅ Shipped | bcrypt compare + HMAC + CSRF + 5/min/IP rate limit |
| `lib/youtube-rotating-key-types.ts` | ✅ Shipped | `KeySlotStats` + `ENDPOINT_QUOTA_COSTS` |
| `lib/youtube-rotating-key.ts` (instrumented) | ✅ Shipped | Per-slot counters; `readSlotStats()` |
| `app/api/youtube/search` + `enrich` | ✅ Updated | Pass explicit `quotaCost` |
| `scripts/hash-password.cjs` | ✅ Shipped | Interactive stdin-based hash generator |
| `app/api/admin/login/route.ts` | ✅ Shipped | Rate-limited bcrypt |
| `app/api/admin/logout/route.ts` | ✅ Shipped | Cookie clear |
| `app/[adminPath]/layout.tsx` | ✅ Shipped | Path + auth + sidebar gate |
| `app/[adminPath]/admin-auth-gate.tsx` | ✅ Shipped | Login form + "not configured" panel |
| `app/[adminPath]/admin-sidebar-nav.tsx` | ✅ Shipped | Brand header + nav + live/inactive styling |
| `app/[adminPath]/admin-logout-button.tsx` | ✅ Shipped | Sidebar footer sign-out |
| `app/[adminPath]/page.tsx` | ✅ Updated | `redirect()` to `/keys` |
| `app/[adminPath]/features/page.tsx` | ✅ Shipped | Card grid + search + CSRF-aware toggle |
| `app/[adminPath]/keys/page.tsx` | ✅ Shipped (v1) | Table + progress + status — chart deferred |
| `app/api/admin/flags/route.ts` | ✅ Shipped | GET/PUT with `requireAdmin` |
| `app/api/admin/keys/route.ts` | ✅ Shipped | Per-slot stats; no chart buckets yet |
| `hooks/use-flags.ts` | ✅ Shipped | Subscribes to `config/flags`; `shouldSkipCreateRoomModal` |
| `app/page.tsx` (modal gating) | ✅ Updated | Hides admin-disabled rows in modal |
| `.env.example` | ✅ Updated | Admin vars documented |
| RTDB rules in your Firebase Console | ⏸ **You do this** | See §7.1 |
| `app/[adminPath]/rooms/page.tsx` | ❌ Not started | Spec §8 rooms |
| `app/[adminPath]/audit/page.tsx` | ❌ Not started | Spec §8 audit |
| `app/api/admin/rooms/*` + `audit/*` | ❌ Not started | |
| Firebase Admin SDK + service account | ❌ Deferred (§7.1) | Proper RTDB rules fix |
| RTDB snapshot persistence (60s writes) | ❌ Deferred (§10) | Process-local counters for v1 |
| `chart.tsx` line chart on `/keys` | ❌ Deferred (§8.10) | `recent: number[]` is already exposed |
