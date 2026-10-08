# User Mic Controls and Room Count Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each phone user control their mic playback volume and echo, and show the current room user count beside the fullscreen controls.

**Architecture:** Persist `micVolumeLevel` on each existing Firebase user record. The host applies that preference only to local playback and the echo wet path; outgoing microphone transport remains unchanged. Remove the admin volume slider and place the user's volume slider beside Echo. Render a compact Users icon/count from the existing room users hook.

**Tech Stack:** Next.js client page, React, Firebase Realtime Database, Web Audio, Vitest, TypeScript.

**Spec:** Approved in-chat design (2026-10-08): user-controlled playback volume alongside Echo; direct mic stream remains untouched; count appears left of the fullscreen controls and includes the host.

## Global Constraints

- Do not add processing to the phone's outgoing microphone stream.
- The host applies the user's volume to direct local playback and the echo path.
- A user without a saved volume preference starts at 80%, matching the existing admin slider's displayed default; 100% is the unattenuated maximum.
- Preserve the current per-user echo preference and its behavior.
- Reuse the existing user record, room hook, slider, and Users icon.

## Review Focus

- Missing user record during preference save: report the failure and do not silently show a saved value.
- Volume boundaries and invalid numbers: clamp to 0–100; host playback remains 0–1.
- User count updates: derive from current room users and include the admin record.
- Existing echo: host volume changes attenuate echo output without changing feedback or outgoing mic audio.

---

### Task 1: Save and apply user-controlled mic volume

**Files:**
- Modify: `lib/microphone-audio.ts`
- Test: `lib/microphone-audio.test.ts`
- Test: `lib/webrtc-service.test.ts`
- Modify: `types/room.ts`
- Modify: `lib/webrtc-service.ts`
- Modify: `app/room/[id]/page.tsx`

**Interfaces:**
- Add `normalizeMicVolumeLevel(level: number): number` to `lib/microphone-audio.ts`.
- Add optional `micVolumeLevel?: number` to the room `User` type.
- Add `updateUserMicVolumeLevel(roomId, userId, level): Promise<void>` in `lib/webrtc-service.ts`.
- Continue using `AdminRTCManager.setUserVolume(userId, volume)` with a normalized 0–1 value.

- [x] Write tests proving volume normalization clamps below 0 and above 100, rounds fractional values, and maps non-finite values to 0.
- [x] Run `npx vitest run lib/microphone-audio.test.ts` and confirm the new import fails before implementation.
- [x] Implement normalization, the Firebase update helper, and host-side application of the stored level to the audio element and echo wet output.
- [x] Add the phone-side volume slider alongside Echo; persist on slider commit and restore the last saved level on failure.
- [x] Remove the admin Users-tab volume slider.
- [x] Run the focused tests and `npx tsc --noEmit`.
- [x] Preserve saved playback preferences across transient WebRTC connection removal; regression test fails before the fix and passes after.

### Task 2: Show room user count by fullscreen controls

**Files:**
- Modify: `app/room/[id]/page.tsx`

**Interfaces:**
- Use the existing `users` array from `useFirebaseUsers(roomId)`; count includes the host record.
- Reuse the existing `Users` icon.

- [x] Add a compact, accessible icon-and-count indicator immediately before the fullscreen-control buttons.
- [x] Confirm the count updates from the existing Firebase users subscription and remains visible for admin and non-admin views.
- [x] Run `npm test -- --run`, `npx tsc --noEmit`, and `git diff --check`.
