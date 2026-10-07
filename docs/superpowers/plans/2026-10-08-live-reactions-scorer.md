# Live Reactions and Scorer Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ephemeral live reactions to the shared karaoke room and make the existing scorer feel more varied and polished without changing the microphone feature.

**Architecture:** Reactions use a small Firebase Realtime Database stream at `rooms/{roomId}/reactions`. Non-admin users push one reaction event through a shared service function; every room client subscribes and renders a local floating animation, with short-lived cleanup to prevent the stream from becoming room history. Scoring remains client-generated and persisted through the existing `saveScore` path, but its pure score generator becomes configurable/testable and uses a weighted distribution instead of a flat 80–100 range.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Firebase Realtime Database, Framer Motion, Tailwind CSS, Vitest.

**Spec:** Approved bounded design in chat on 2026-10-08; microphone explicitly deferred.

## Global Constraints

- Reactions are available to non-admin room users and visible to the admin in `/room/[id]?admin=true`.
- Reaction events are ephemeral; do not add a reaction history screen or analytics in this slice.
- Keep the existing Firebase room and scorer persistence paths compatible.
- Do not change microphone behavior or WebRTC code.
- Do not add a new production dependency; Vitest is test-only infrastructure if no existing test runner is available.
- Preserve keyboard/TV focus behavior and provide accessible labels for reaction buttons.
- Add `reactionsEnabled` to the existing global admin flags and per-room creation settings.

## Review Focus

- A room with no reaction data must render normally and subscribe without throwing.
- Invalid or empty reaction input must not be written to Firebase.
- Rapid repeated taps must create separate visible reaction events so a user can intentionally send a burst.
- A stale reaction event or a client that reconnects must not leave an unbounded visible overlay.
- Score generation must always stay within the supported 70–100 display range and still produce ordinary, good, and exceptional performances.

### Task 1: Add the tested reaction and scoring primitives

**Files:**
- Create: `lib/realtime-reactions.ts`
- Modify: `types/room.ts`
- Modify: `lib/scoring-service.ts`
- Create: `lib/scoring-service.test.ts`
- Create: `lib/realtime-reactions.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json` or `pnpm-lock.yaml` (use the lockfile selected by the existing npm workflow)

**Interfaces:**
- Produces `Reaction` in `types/room.ts` with `id?: string`, `emoji: string`, `userName: string`, and `createdAt: number`.
- Produces `REACTION_OPTIONS` as a readonly list of `{ emoji: string; label: string }` values for the UI.
- Produces `isValidReaction(reaction: Pick<Reaction, "emoji" | "userName">): boolean`.
- Produces `generatePerformanceScore(random?: () => number): number`, returning an integer from 70 through 100 and allowing deterministic tests.
- Produces `sendReaction(roomId: string, reaction: Omit<Reaction, "id" | "createdAt">): Promise<string>` and `subscribeToReactions(roomId: string, callback: (reactions: Reaction[]) => void): () => void`.

- [ ] **Step 1: Add the failing score tests**

  Assert that a supplied random source produces the expected weighted bucket values, that the result is always an integer from 70–100 across repeated calls, and that the helper never returns a value outside the display range.

- [ ] **Step 2: Add the failing reaction tests**

  Assert that the fixed reaction list has accessible labels, valid trimmed usernames are accepted, blank/oversized usernames and unsupported emoji are rejected, and snapshot data is normalized into `Reaction` objects while malformed entries are ignored. Do not reject or coalesce repeated events: five valid writes must remain five reaction events.

- [ ] **Step 3: Run the focused tests and verify they fail for the missing interfaces**

  Run: `npm test -- --run lib/scoring-service.test.ts lib/realtime-reactions.test.ts`

  Expected: FAIL because the new helpers and test script do not exist yet.

- [ ] **Step 4: Add the smallest Vitest script and test dependency**

  Add `"test": "vitest"` to `package.json` and add Vitest as a dev dependency using the existing npm lockfile workflow. Do not add a second test framework.

- [ ] **Step 5: Implement the score helper in `lib/scoring-service.ts`**

  Keep the existing animation and rating APIs intact. Implement the weighted buckets through the injected random function: 70–79 uncommon, 80–89 common, 90–96 good, and 97–100 exceptional. Use `Math.random` as the default.

- [ ] **Step 6: Implement Firebase reaction normalization and subscription in `lib/realtime-reactions.ts`**

  Use Firebase `push`, `set`, `onValue`, `off`, and `remove` against `rooms/{roomId}/reactions`. Validate before writing, return the generated key, sort normalized events newest-first, and remove invalid entries from the callback result. Keep cleanup local to the consumer so the helper remains usable in both room clients.

- [ ] **Step 7: Run the focused tests and verify they pass**

  Run: `npm test -- --run lib/scoring-service.test.ts lib/realtime-reactions.test.ts`

  Expected: PASS with all score and reaction primitive assertions green.

- [ ] **Step 8: Commit the primitives**

  ```bash
  git add lib/realtime-reactions.ts lib/realtime-reactions.test.ts lib/scoring-service.ts lib/scoring-service.test.ts types/room.ts package.json package-lock.json
  git commit -m "feat: add realtime reactions and varied score generation"
  ```

### Task 2: Add the non-admin reaction picker and shared floating overlay

**Files:**
- Create: `components/reaction-picker.tsx`
- Create: `components/reaction-overlay.tsx`
- Modify: `app/room/[id]/page.tsx`
- Modify: `app/room/styles.css`

**Interfaces:**
- Consumes `REACTION_OPTIONS`, `sendReaction`, and `subscribeToReactions` from Task 1.
- Produces `ReactionPicker` with props `{ roomId: string; userName: string; disabled?: boolean }`.
- Produces `ReactionOverlay` with props `{ roomId: string }`.

- [ ] **Step 1: Add component-level tests or testable pure behavior for picker and overlay state**

  Pin the user-visible behavior: the picker exposes one labeled button per configured reaction, calls `sendReaction` with the current trimmed username, ignores empty names, and the overlay only renders recent events while expired events leave the DOM.

- [ ] **Step 2: Run the component tests and verify they fail**

  Run: `npm test -- --run components/reaction-picker.test.tsx components/reaction-overlay.test.tsx`

  Expected: FAIL because the components do not exist yet. If the current environment lacks a DOM test setup, keep the primitive tests as the executable gate and verify the component behavior with TypeScript/build checks in Task 4.

- [ ] **Step 3: Implement `ReactionPicker`**

  Render the fixed options as accessible buttons, disable while the room/user is unavailable, send one Firebase event per click without debouncing or coalescing, and show a small non-blocking error state if Firebase rejects a send.

- [ ] **Step 4: Implement `ReactionOverlay`**

  Subscribe on mount, keep each event as its own visible item while it is newer than the visible lifetime, render each as a separately positioned Framer Motion item with the sender name, and remove each item after the animation. Respect `prefers-reduced-motion` by keeping each event visible briefly without the full flight animation.

- [ ] **Step 5: Add the picker and overlay to the room page**

  Render `ReactionOverlay` for both admin and non-admin users. Render `ReactionPicker` only for non-admin users after the name is known, positioned near the existing room controls without covering the YouTube player or TV navigation controls.

- [ ] **Step 6: Add only the required overlay CSS**

  Add a fixed, pointer-events-none overlay layer, responsive positioning, and a reduced-motion fallback. Reuse existing colors and avoid a new animation library or global layout refactor.

- [ ] **Step 7: Run focused verification**

  Run: `npm test -- --run lib/scoring-service.test.ts lib/realtime-reactions.test.ts` and `npx tsc --noEmit`.

  Expected: tests PASS and TypeScript reports no errors.

- [ ] **Step 8: Commit the reaction UI**

  ```bash
  git add components/reaction-picker.tsx components/reaction-overlay.tsx app/room/[id]/page.tsx app/room/styles.css
  git commit -m "feat: show live room reactions"
  ```

### Task 3: Polish scorer presentation without changing its persistence contract

**Files:**
- Modify: `components/score-display.tsx`
- Modify: `app/room/[id]/page.tsx`
- Modify: `lib/scoring-service.ts` only if Task 1 tests expose a needed boundary issue

**Interfaces:**
- Consumes the tested `generatePerformanceScore()` from Task 1.
- Preserves `ScoreDisplayModal` props and the existing `saveScore(roomId, userId, userName, songTitle, score)` call.

- [ ] **Step 1: Add a scorer regression assertion**

  Assert that opening the scorer uses one generated final score, the final displayed value is the persisted value, and closing the modal still clears audio/animation state without advancing the queue.

- [ ] **Step 2: Run the scorer test and verify it fails or identifies the current behavior**

  Run: `npm test -- --run components/score-display.test.tsx`

  Expected: the test either fails against the current implementation or documents the existing behavior before the UI-only polish. Do not weaken the test to accommodate a regression.

- [ ] **Step 3: Implement the minimal scorer polish**

  Use the new generator once per reveal, remove debug logging/fallback audio noise, keep the current `saveScore` timing, make the score reveal and rating copy visually consistent with the new range, and ensure the star animation does not call `Math.random()` during every render.

- [ ] **Step 4: Run scorer and type checks**

  Run: `npm test -- --run lib/scoring-service.test.ts components/score-display.test.tsx` and `npx tsc --noEmit`.

  Expected: all selected tests PASS and TypeScript reports no errors.

- [ ] **Step 5: Commit the scorer polish**

  ```bash
  git add components/score-display.tsx app/room/[id]/page.tsx lib/scoring-service.ts
  git commit -m "feat: polish karaoke score reveal"
  ```

### Task 4: Verify the branch and review the final diff

**Files:**
- Modify: documentation only if the final behavior changes user-facing setup or usage instructions.

**Interfaces:**
- Consumes all previous task interfaces and the existing admin/room feature flags.
- Produces a verified branch with no microphone changes.

- [ ] **Step 1: Run the complete automated checks**

  Run: `npm test -- --run`, `npx tsc --noEmit`, and `npm run build`.

  Expected: all tests PASS, TypeScript exits 0, and the Next.js production build exits 0. If an existing unrelated check fails, capture the exact failure and separate it from the feature result.

- [ ] **Step 2: Manually verify the two room roles**

  Open one non-admin room client and one `/room/[id]?admin=true` client for the same room. Confirm a non-admin can send a labeled reaction, five rapid taps produce five separate floating reactions in the admin view, the admin has no reaction picker, and the events disappear without a page reload. Confirm scorer output varies across runs, stays 70–100, saves once, and does not change queue advancement.

- [ ] **Step 3: Review the diff for scope and security**

  Check that only room reaction paths and scorer presentation changed, no microphone/WebRTC files changed, untrusted reaction text is rendered through React text nodes, and no admin-only route or credential is exposed.

- [ ] **Step 4: Run the final status check and commit any documentation update**

  Run: `git status --short --branch` and `git diff --check`.

  Expected: no whitespace errors; only intended files are changed.

### Task 5: Add admin control for live reactions

**Files:**
- Create: `lib/feature-flags.test.ts`
- Create: `lib/feature-flags.ts`
- Modify: `hooks/use-flags.ts`
- Modify: `app/[adminPath]/features/page.tsx`
- Modify: `app/api/admin/flags/route.ts`
- Modify: `app/page.tsx`
- Modify: `lib/firebase-service.ts`
- Modify: `types/room.ts`
- Modify: `app/room/[id]/page.tsx`
- Modify: `lib/admin-room.ts`
- Modify: `app/[adminPath]/rooms/page.tsx`

**Interfaces:**
- Produces `Flags.reactionsEnabled`, defaulting to `true` when the global config is absent.
- Produces `createRoom(..., reactionsEnabled)` persistence at `rooms/{roomId}/reactionsEnabled`.
- Consumes `roomData.reactionsEnabled` to gate the picker and overlay.

- [x] **Step 1: Add the failing feature flag tests**
- [x] **Step 2: Implement normalization and modal skip behavior**
- [x] **Step 3: Add admin toggle, API payload support, and creation-modal switch**
- [x] **Step 4: Gate the room UI and expose the room badge**
- [x] **Step 5: Verify focused tests and TypeScript**
