# Admin Dashboard Pending Work Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the repository-owned pending portions of Spec 4: room management, audit history, key-stat persistence, and hourly key usage visualization.

**Architecture:** Reuse the existing dynamic admin route, `requireAdmin()` guard, Firebase Realtime Database client, and shadcn/recharts components. Keep admin data access in small route handlers and pure helpers so room activity calculation and key snapshot shaping are testable without a browser. Keep secrets in environment variables; persist only masked key statistics.

**Tech Stack:** Next.js App Router, TypeScript, Firebase Realtime Database, React, Recharts, existing UI primitives.

**Spec:** `specs/04-admin-dashboard.md`

## Global Constraints

- Admin failures remain indistinguishable from missing routes (`404`), except missing admin configuration (`503 ADMIN_NOT_CONFIGURED`).
- Mutating admin endpoints require the double-submit CSRF header.
- Feature flags default to enabled when `config/flags` is absent.
- Room idle time uses newest user `lastSeen`, falling back to `createdAt`.
- Full YouTube keys never leave process memory; RTDB receives masked tails and counters only.
- Existing dependencies and route conventions are reused.

## Review Focus

- Empty or malformed room nodes must not break listing or purge; test fallback behavior in the room activity helper.
- Room deletion must be CSRF protected and audit logged; test the route guard and audit payload.
- Key snapshots must survive process restart without exposing key material; test serialization and restore shape.
- Missing persisted stats must leave current in-memory behavior intact; test an empty snapshot.
- Hourly chart data must render with no slots and with sparse buckets; test the data transformation.

---

### Task 1: Room data helpers and cleanup semantics

**Files:**
- Modify: `lib/firebase-service.ts`
- Create: `lib/admin-room.ts`
- Test: `lib/admin-room.test.ts` (or the repository's available test location)

**Interfaces:**
- Produces `roomLastActivity(room: unknown): number | null` and `roomIsIdle(room: unknown, cutoffMs: number): boolean`.
- `cleanupOldRooms(daysOld)` uses the shared activity calculation.

- [ ] Write tests for newest `users[*].lastSeen`, `createdAt` fallback, malformed dates, and idle comparison.
- [ ] Run the focused test and confirm it fails before implementation.
- [ ] Implement the pure helpers and update `cleanupOldRooms` to use them.
- [ ] Run the focused test and the existing type/build checks.

### Task 2: Admin room and audit APIs

**Files:**
- Create: `app/api/admin/rooms/route.ts`
- Create: `app/api/admin/rooms/[roomId]/route.ts`
- Create: `app/api/admin/audit/route.ts`
- Create: `lib/admin-audit.ts`

**Interfaces:**
- `GET /api/admin/rooms` returns normalized rooms with users, queue, scores, current song, and last activity.
- `DELETE /api/admin/rooms/[roomId]` deletes one room and writes `room.delete` audit entry.
- `POST /api/admin/rooms/purge` deletes rooms idle beyond a validated hour threshold and writes `room.purge` audit entry.
- `GET /api/admin/audit` returns newest 50 audit entries.

- [ ] Add route-level tests for auth failure, CSRF failure, delete, purge validation, and audit response ordering.
- [ ] Implement using existing Firebase `get`, `remove`, `push`, and `set` operations.
- [ ] Keep audit entries bounded to the newest 50 at read time.

### Task 3: Rooms and audit pages

**Files:**
- Create: `app/[adminPath]/rooms/page.tsx`
- Create: `app/[adminPath]/audit/page.tsx`
- Modify: `app/[adminPath]/admin-sidebar-nav.tsx`

**Interfaces:**
- Rooms page subscribes through manual refresh plus silent live refresh, supports one expanded card, per-room delete, checkbox multi-select, bulk delete, and idle purge.
- Audit page displays newest entries in a compact table.

- [ ] Add component tests or pure data tests for single-open accordion and selected-room counts.
- [ ] Implement pages with existing UI components and the CSRF cookie helper pattern.
- [ ] Verify mobile layout and empty/loading/error states through the production build.

### Task 4: Persist and restore key statistics

**Files:**
- Modify: `lib/youtube-rotating-key.ts`
- Modify: `lib/youtube-rotating-key-types.ts`
- Modify: `app/api/admin/keys/route.ts`

**Interfaces:**
- Snapshot path: `config/keyStats/<slot>`.
- Snapshot contains masked `last4`, cumulative request/unit totals, rolling request timestamps, and `quotaExceededAt`.
- Writes are throttled to approximately once per 60 seconds; boot restore is best-effort.

- [ ] Add tests for snapshot serialization, masked values, restore, and throttling.
- [ ] Implement lazy Firebase persistence so YouTube requests retain existing behavior if RTDB is unavailable.
- [ ] Return rolling hourly buckets from the keys API.

### Task 5: Hourly key usage chart

**Files:**
- Modify: `app/[adminPath]/keys/page.tsx`

**Interfaces:**
- Render one Recharts line series per slot from the API's 24 hourly buckets.
- Preserve the existing table, progress bars, status, and countdown.

- [ ] Add a data transformation test for sparse and empty slot data.
- [ ] Implement the chart using existing `components/ui/chart.tsx` primitives.

### Task 6: Documentation and verification

**Files:**
- Modify: `specs/04-admin-dashboard.md`
- Modify: `README.md` (only if setup instructions are missing)

- [ ] Update the implementation-status table for completed repository work and leave Firebase Console work explicitly marked.
- [ ] Run the full available verification commands: typecheck/build, lint if supported, and focused tests.
- [ ] Perform a final diff review for unnecessary abstractions and accidental secret exposure.
