# Feature Experimental Labels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins independently mark the three existing features experimental and show conditional Experimental badges in creation and room UI.

**Architecture:** Extend the existing shared flag model and `/api/admin/flags` contract with optional, default-off experimental metadata while preserving enabled flags and older clients. Make admin feature cards expose separate accessible controls, then render a small shared badge component in the creation modal and room feature surfaces using the live global flags subscription.

**Tech Stack:** Next.js 14, React, TypeScript, Firebase Realtime Database, Vitest, existing Radix Switch and Badge components.

**Spec:** `docs/specs/FEATURE-EXPERIMENTAL1008-spec.md`

**Execution status:** Tasks 1–3 are committed. Tests and TypeScript pass. Lint is unavailable until the project has an ESLint configuration; build is deferred while two Next.js dev servers share `.next`. The open admin browser tab continued to render its old card UI, so toggles were not clicked against the shared Firebase configuration.

## Global Constraints

- Experimental state defaults to `false` when absent or invalid.
- Experimental state is presentation metadata only; it does not enable or disable a feature.
- Older flags clients may omit experimental properties; those updates must preserve persisted experimental values.
- The flags API remains admin-authenticated and rejects invalid values and unknown request keys.
- Keep current room tabs; no navigation redesign or new dependencies.

## Review Focus

- Old clients omit experimental fields: an update must preserve the values already stored in Firebase.
- First-time or old Firebase records omit experimental fields: defaults must be `false` without changing enabled-flag semantics.
- One failed admin toggle save must restore the previous value and not silently leave optimistic state displayed.
- A globally experimental feature disabled for room creation or a specific room must not appear as an available feature or misleading badge.
- On room pages, global experimental metadata must update badges without changing room-level feature availability.

---

### Task 1: Extend the shared feature-flag model and API

**Files:**
- Modify: `lib/feature-flags.ts`
- Test: `lib/feature-flags.test.ts`
- Modify: `app/api/admin/flags/route.ts`
- Test: `app/api/admin/flags/route.test.ts` (create)

**Interfaces:**
- `Flags` adds `phoneMicExperimental`, `scorerExperimental`, and `reactionsExperimental`, each boolean.
- `DEFAULT_FLAGS` and `normalizeFlags(raw)` assign `false` to missing or non-boolean experimental values; enabled defaults remain unchanged.
- `PUT /api/admin/flags` requires all three enabled booleans and accepts each experimental boolean optionally. Omitted experimental keys are preserved in storage. Only the six known keys are accepted.

- [x] **Step 1: Write flag-model tests** for default-false experimental values, mixed valid values, and invalid/missing experimental inputs while asserting enabled defaults remain as before.
- [x] **Step 2: Run `npx vitest run lib/feature-flags.test.ts`** and confirm the new assertions fail before implementation.
- [x] **Step 3: Extend `Flags`, `DEFAULT_FLAGS`, and `normalizeFlags`** with the three experimental booleans; keep `shouldSkipCreateRoomModal` based only on enabled flags.
- [x] **Step 4: Run `npx vitest run lib/feature-flags.test.ts`** and confirm the model tests pass.
- [x] **Step 5: Add route tests** for admin authorization on GET/PUT, GET defaults for old stored records, valid complete enabled state with optional experimental values, omitted experimental values preserving stored state, malformed JSON/invalid types, and unknown-key rejection.
- [x] **Step 6: Run `npx vitest run app/api/admin/flags/route.test.ts`** and confirm the new compatibility/validation assertions expose the current route gaps while existing authorization assertions pass.
- [x] **Step 7: Implement GET defaults and validated PUT updates** in `app/api/admin/flags/route.ts`. Use Firebase `update` semantics so omitted experimental and unrelated stored metadata are not erased; retain current admin guard and audit logging.
- [x] **Step 8: Re-run `npx vitest run lib/feature-flags.test.ts app/api/admin/flags/route.test.ts`** and confirm all focused tests pass.
- [x] **Step 9: Commit** as `feat: add experimental feature flags` (`be6915c`).

### Task 2: Add independent admin controls

**Files:**
- Modify: `app/[adminPath]/features/page.tsx`
- Create: `components/admin-feature-toggles.tsx`
- Test: `components/admin-feature-toggles.test.tsx` (create)
- Create: `vitest.config.mts` to enable existing Vitest/Oxc JSX and the `@` alias for component tests; no new dependency.
- Existing control: `components/ui/switch.tsx`

**Interfaces:**
- Each feature definition maps its enabled key to its experimental key.
- Admin page state uses the six-field `Flags` shape from Task 1 and submits both states to the existing endpoint.

- [x] **Step 1: Refactor the feature card markup** so enabled and experimental states have distinct labeled Switch controls, replacing the clickable-card `role="button"`; neither control is nested inside another interactive element.
- [x] **Step 2: Load all six fields** from GET, coercing the existing enabled values exactly as before and defaulting absent experimental values to `false`.
- [x] **Step 3: Implement independent optimistic saves** for enabled and experimental controls, preserving the other five values in each request and reverting the affected state on failure.
- [ ] **Step 4: Verify interaction and accessibility** in the browser: the open admin tab still renders the pre-change card UI; its toggles were not changed because they write global flags. Server-render tests confirm two separate, named switch controls and disabled state.
- [x] **Step 5: Commit** as `feat: add admin experimental controls` (`5acd835`).

### Task 3: Add conditional badges to feature surfaces

**Files:**
- Create: `components/experimental-badge.tsx`
- Test: `components/experimental-badge.test.tsx` (create)
- Modify: `app/page.tsx`
- Modify: `app/room/[id]/page.tsx`
- Modify: `components/reaction-picker.tsx`

**Interfaces:**
- `ExperimentalBadge({ experimental }: { experimental: boolean })` renders the text `Experimental` only when true and renders nothing otherwise.
- `ReactionPicker` accepts an optional `experimental` boolean, defaulting to `false` for compatibility.

- [x] **Step 1: Add server-render tests** for `ExperimentalBadge`: true renders the visible `Experimental` label; false renders no label.
- [x] **Step 2: Run `npx vitest run components/experimental-badge.test.tsx`** and confirm it fails because the component does not exist.
- [x] **Step 3: Implement the small shared badge** as a styled inline `span` so it remains valid inside labels and headings, with a non-interactive visual label.
- [x] **Step 4: Replace both static BETA labels** in `app/page.tsx` with the matching conditional badge: `phoneMicExperimental` and `scorerExperimental`. Add the conditional badge for Live Reactions using `reactionsExperimental`.
- [x] **Step 5: Subscribe the room page to `useFlags()`** and pass global experimental state to `ReactionPicker`; render matching labels beside the Phone Microphone and Karaoke Champions/scorer labels only when the relevant room feature is enabled.
- [x] **Step 6: Add the conditional badge to the floating Reactions control** and ensure admin overlay behavior is unchanged.
- [x] **Step 7: Run `npx vitest run components/experimental-badge.test.tsx components/reaction-overlay.test.ts`** and verify badge rendering and existing reaction behavior.
- [x] **Step 8: Commit** as `feat: show experimental badges in rooms` (`bccfac9`).

### Task 4: Full verification and review

**Files:**
- Review all files modified in Tasks 1–3.

- [x] **Step 1: Run `npm test -- --run`** and confirm all tests pass (9 files, 44 tests).
- [x] **Step 2: Run `npx tsc --noEmit`** and confirm no type errors.
- [x] **Step 3: Run `npm run lint`**; it exits into Next's first-time ESLint configuration prompt because no ESLint configuration exists. No configuration was generated.
- [x] **Step 4: Defer `npm run build`** while two `next dev` processes share `.next`; a fresh process check confirmed both were still active.
- [ ] **Step 5: Manually verify** admin toggle persistence, Mic/Reactions room badges, and independence from feature enablement. Modal and scorer badges were visible in the browser; admin toggle interaction was not attempted to avoid changing shared flags, and the live admin tab still served its old card markup.
- [x] **Step 6: Review the full diff** for API validation, accessible independent controls, badge placement, and unnecessary complexity; `git diff --check` passed.
- [ ] **Step 7: Commit** any necessary final fixes separately; report test/build results without claiming unrun checks.
