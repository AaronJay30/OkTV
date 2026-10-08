# Microphone Audio Polish Design

**Status:** Awaiting user review  
**Approved design direction:** Preserve natural singing tone with light echo control; remove app-added audio processing that clips vocals or adds buffering.

## Goal

Make phone microphone audio sound more natural and arrive at the host with less app-added delay, while preserving the existing room controls and WebRTC signaling flow.

## Current behavior

Microphone capture currently requests echo cancellation, noise suppression, and automatic gain control. Before WebRTC, `MicrophoneRTCManager` routes the captured stream through `createLowLatencyAudioStream`, which uses a deprecated `ScriptProcessorNode` and a hard noise gate at an absolute sample level of `0.01`. This can cut off quiet vocal notes and create choppy or static-like sound. The host then routes each received stream through another `AudioContext` before assigning it to an audio element. WebRTC SDP is also manually rewritten for Opus parameters.

## Design

### Capture and sending

- Request `echoCancellation: { ideal: true }` to reduce feedback when the room music plays through speakers.
- Request `noiseSuppression: { ideal: false }` and `autoGainControl: { ideal: false }` so the browser does not aggressively alter a singing voice. These are preferences, not hard requirements; browsers may apply their own supported behavior.
- Send the original `getUserMedia` stream directly using `RTCPeerConnection.addTrack`.
- Remove the custom sample gate, `ScriptProcessorNode`, forced sample rate, and app-created capture-side audio context.

### WebRTC and host playback

- Use the browser's normal WebRTC audio negotiation and Opus handling; remove the custom SDP rewriting and its wrapper around `setLocalDescription`/`setRemoteDescription`.
- Assign the received remote stream directly to the host audio element. Do not create an `AudioContext`, media-stream destination, or intermediate processed stream for playback.
- Keep existing per-user host volume controls, mute/unmute behavior, room feature gating, and Firebase signaling/status paths.

### Lifecycle and compatibility

- Turning a user's mic off, an admin mute, a failed connection, or leaving the room must close the peer connection and stop the local capture tracks.
- Removing the intermediate audio contexts also removes their associated cleanup paths.
- If a browser does not honor an ideal capture preference, continue with the stream it provides. Keep the existing unsupported-device and permission error behavior.
- Actual end-to-end delay depends on the device, browser, network, and WebRTC jitter buffer. The requirement is to remove avoidable processing inside this app, not promise a fixed millisecond latency.

## Out of scope

- New audio effects, equalizers, compressors, or user-selectable sound profiles.
- A new signaling service, SFU, or change to Firebase signaling.
- Changes to microphone feature enablement, admin permissions, room UI, or per-user volume UI beyond what is needed to keep the direct stream working.
- Guaranteed synchronization across devices or networks.

## Acceptance criteria

- **AC-MIC-AUDIO-FIDELITY1:** Capture requests echo cancellation as an ideal preference and requests noise suppression and automatic gain control off as ideal preferences.
- **AC-MIC-AUDIO-FIDELITY2:** The captured audio track reaches `RTCPeerConnection.addTrack` without passing through an app-created noise gate, `ScriptProcessorNode`, or `AudioContext`.
- **AC-MIC-AUDIO-LATENCY1:** The host plays the received stream directly from the remote track without creating an intermediate audio-processing context or destination stream.
- **AC-MIC-AUDIO-COMPAT1:** Unsupported or ignored ideal capture preferences do not prevent a browser-supported microphone stream from connecting.
- **AC-MIC-AUDIO-CONTROL1:** Existing user mic toggle, host mute/unmute, and per-user volume controls continue to work with direct streams.
- **AC-MIC-AUDIO-CLEANUP1:** Mic-off, host mute, connection removal, and room teardown close peer connections and stop local microphone tracks; no per-user audio element or audio context is left behind.

## Verification approach

- Add focused tests for the requested capture preferences and direct stream routing/cleanup where these behaviors can be tested without browser hardware.
- Run the existing test suite and TypeScript check.
- Manually test on two devices: enable a mic, sing sustained quiet and loud notes, compare the host playback for gating/static, adjust the host volume, mute/unmute, and turn the mic off. Listen for reduced app-added lag while noting that network and browser conditions affect the result.
- Run a production build with all dev servers stopped so Next.js does not share its `.next` output with `next dev`.
