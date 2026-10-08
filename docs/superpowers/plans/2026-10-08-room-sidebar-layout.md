# Room Sidebar Layout Implementation Plan

> **For agentic workers:** execute inline using the approved design and TDD.

**Goal:** Make room sidebar navigation and Karaoke Champions readable at narrow widths.

**Architecture:** Keep the existing Radix tabs and feature gates. Present tabs in a two-column grid, reduce content spacing, and constrain score card text with accessible full-title text. Add a small pure formatter for score song title/artist display so its behavior is testable.

**Tech Stack:** Next.js, React, Tailwind CSS, Vitest.

**Spec:** Approved design in the user conversation (2026-10-08): two-column tabs; tighter panel spacing; redesigned compact score cards with ellipsized long titles and full titles available on hover/focus; preserve tab and feature-gating behavior.

## Global Constraints

- Preserve all existing tab visibility and selection behavior.
- Do not add dependencies or alter feature gating.
- Preserve full song title access while visually truncating it.

## Review Focus

- Five tabs (including Mic) remain comfortably readable in the sidebar.
- Song titles with and without ` - ` remain distinguishable, with long strings constrained.
- Narrow score cards do not grow beyond the sidebar width.
- Feature-gated tabs remain absent when disabled.

### Task 1: Room sidebar and score cards

**Files:**
- Modify: `app/room/[id]/page.tsx`
- Modify: `components/high-scores.tsx`
- Create: `lib/score-display.ts`
- Test: `lib/score-display.test.ts`

- [x] Write tests for extracting title/artist from `Song - Artist` and retaining unsplit titles.
- [x] Run the focused test and confirm it fails because the formatter does not exist.
- [x] Implement the formatter and verify the focused test passes.
- [x] Update the tabs to a two-column grid and reduce the gap before panel content.
- [x] Redesign score cards with bounded text, ellipsis, and full-title hover/focus text.
- [x] Run the complete test suite, TypeScript check, and diff whitespace check.

**Review:** Self-review found no further changes; no independent reviewer was used.

**Verification:** `npm test -- --run` (46/46), `npx tsc --noEmit` (exit 0), and `git diff --check` (exit 0). Production build not run because two Next.js dev servers are using the shared `.next` directory.
