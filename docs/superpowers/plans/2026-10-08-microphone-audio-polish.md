# Microphone Audio Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve natural phone-microphone vocals and remove avoidable app-added delay from the host audio path.

**Architecture:** Use browser capture preferences for light echo control and natural voice dynamics, then send the original stream through WebRTC without custom sample processing. The host will attach the received stream directly to one audio element per user, preserving existing mute and volume controls. A small audio utility module will hold testable capture, stream-routing, and cleanup operations.

**Tech Stack:** Next.js 14, React 18, TypeScript, WebRTC, Firebase Realtime Database, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-08-microphone-audio-polish-design.md`

## Global Constraints

- Request `echoCancellation: { ideal: true }`.
- Request `noiseSuppression: { ideal: false }` and `autoGainControl: { ideal: false }`.
- Send the original `getUserMedia` stream directly with `RTCPeerConnection.addTrack`.
- Do not add an app-created capture or playback `AudioContext`, `ScriptProcessorNode`, noise gate, or forced sample rate.
- Use normal WebRTC/Opus negotiation; do not rewrite SDP.
- Preserve room signaling, feature enablement, mic permission behavior, host mute/unmute, and per-user volume controls.
- Treat capture preferences as best-effort and do not promise fixed network latency.
- Do not add production dependencies.

## Review Focus

- Quiet singing must not be cut off by an app-level gate — Task 1 tests direct sender routing and capture constraints.
- Browsers that ignore an ideal capture preference must still be able to send a supported stream — Task 1 verifies preferences are ideal rather than mandatory; manual QA covers browser support.
- Host playback must use the actual remote stream without a second processing chain — Task 2 tests direct attachment.
- Removing a remote user must not stop unrelated local capture tracks — Task 2 tests that remote cleanup detaches playback without stopping received tracks.
- Leaving the room must release local capture and remove host audio elements — Task 1 tests local track cleanup; Task 2 tests host playback cleanup and includes a two-device manual check.

---

### Task 1: Capture natural audio and send the original stream

**Files:**
- Create: `lib/microphone-audio.ts`
- Create: `lib/microphone-audio.test.ts`
- Modify: `hooks/useMicrophone.ts`
- Modify: `lib/webrtc-service.ts`
- Delete: `lib/audio-optimizer.ts`

**Interfaces:**
- Produces `getMicrophoneAudioConstraints(): MediaTrackConstraints`, with ideal echo cancellation on and ideal noise suppression and automatic gain control off.
- Produces `addMicrophoneTracks(peerConnection: Pick<RTCPeerConnection, "addTrack">, stream: MediaStream): void`, adding each audio track with the original stream.
- Produces `stopAudioTracks(stream: Pick<MediaStream, "getTracks">): void`, stopping every track in the provided stream.
- `useMicrophone.startMicrophone()` requests the stream with the utility constraints.
- `MicrophoneRTCManager.initialize(stream)` adds tracks from and retains the original capture stream.

- [ ] **Step 1: Write failing tests for capture preferences and direct routing**

  Assert the exact ideal constraint values, that every audio track is added with the original stream, and that local cleanup stops every track.

- [ ] **Step 2: Run the focused test and confirm it fails because the utility module is missing**

  Run: `npm test -- --run lib/microphone-audio.test.ts`  
  Expected: FAIL because the module/functions are not implemented.

- [ ] **Step 3: Implement the tested utilities and wire capture/sending to them**

  Replace inline capture constraints; use `addMicrophoneTracks` with the original stream; remove the capture-side processing and `optimizePeerConnectionForAudio` calls. Delete `lib/audio-optimizer.ts`, including its noise gate, `ScriptProcessorNode`, and SDP rewriting. Keep the existing ICE server configuration.

- [ ] **Step 4: Run focused tests and TypeScript check**

  Run: `npm test -- --run lib/microphone-audio.test.ts` and `npx tsc --noEmit`  
  Expected: both pass and no `audio-optimizer` imports remain.

### Task 2: Play remote audio directly and clean up both sides

**Files:**
- Modify: `lib/microphone-audio.ts`
- Modify: `lib/microphone-audio.test.ts`
- Modify: `lib/webrtc-service.ts`
- Modify: `app/room/[id]/page.tsx`

**Interfaces:**
- Produces `attachRemoteAudioStream(audioElement: HTMLAudioElement, stream: MediaStream): void`, assigning the exact incoming stream and enabling autoplay/inline playback.
- Produces `detachRemoteAudioElement(audioElement: HTMLAudioElement): void`, pausing playback, clearing `srcObject`, and removing the element without stopping remote receiver tracks.
- `AdminRTCManager` owns one direct-stream audio element per connected user; existing `setUserVolume(userId, volume)` continues to control it.

- [ ] **Step 1: Write failing tests for remote stream attachment and detachment**

  Assert the host audio element receives the exact `MediaStream`, has autoplay/inline playback enabled, and detachment pauses, clears, and removes it without calling `stop()` on its tracks.

- [ ] **Step 2: Run the focused test and confirm it fails because remote audio helpers are missing**

  Run: `npm test -- --run lib/microphone-audio.test.ts`  
  Expected: FAIL because the remote playback helpers are not implemented.

- [ ] **Step 3: Replace processed and duplicate host playback with direct attachment**

  In `AdminRTCManager.ontrack`, create or reuse the user's audio element and attach the received stream directly. Remove the page callback's second audio element creation so it only updates connection state and notifications. Use `detachRemoteAudioElement` on mute, connection removal, and manager close; preserve the volume setter.

- [ ] **Step 4: Ensure room teardown releases local capture and host playback**

  Confirm `MicrophoneRTCManager.close()` uses `stopAudioTracks` on its original local stream. Ensure room teardown closes the user manager and the admin manager removes all owned audio elements.

- [ ] **Step 5: Run tests, type check, diff check, and production build**

  Run: `npm test -- --run`, `npx tsc --noEmit`, and `git diff --check`. Stop all project dev servers, then run `npm run build` to avoid sharing `.next` with `next dev`.  
  Expected: all checks pass; one host audio element is managed per connected user.

- [ ] **Step 6: Manually verify audio on two devices**

  Connect a phone and host; sing quiet and loud sustained notes; confirm quieter vocals are not gated, host playback is direct, volume adjustment works, host mute stops the sender, unmute allows the user to reconnect, and leaving the room releases the microphone. Compare perceived delay under the same network conditions before and after.
