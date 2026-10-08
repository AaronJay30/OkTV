import { describe, expect, it, vi } from "vitest";
import {
    addMicrophoneTracks,
    attachRemoteAudioStream,
    detachRemoteAudioElement,
    getIncomingAudioDiagnostics,
    getMicrophoneCaptureLatency,
    getMicrophoneAudioConstraints,
    stopAudioTracks,
} from "./microphone-audio";

describe("getMicrophoneAudioConstraints", () => {
    it("prefers echo cancellation without suppressing or auto-leveling vocals", () => {
        expect(getMicrophoneAudioConstraints()).toEqual({
            echoCancellation: { ideal: true },
            noiseSuppression: { ideal: false },
            autoGainControl: { ideal: false },
        });
    });
});

describe("addMicrophoneTracks", () => {
    it("adds each audio track with the original capture stream", () => {
        const tracks = [{ kind: "audio" }, { kind: "audio" }] as MediaStreamTrack[];
        const stream = {
            getAudioTracks: () => tracks,
        } as unknown as MediaStream;
        const peerConnection = { addTrack: vi.fn() };

        addMicrophoneTracks(peerConnection, stream);

        expect(peerConnection.addTrack).toHaveBeenNthCalledWith(1, tracks[0], stream);
        expect(peerConnection.addTrack).toHaveBeenNthCalledWith(2, tracks[1], stream);
    });
});

describe("stopAudioTracks", () => {
    it("stops every local capture track", () => {
        const tracks = [{ stop: vi.fn() }, { stop: vi.fn() }];
        const stream = { getTracks: () => tracks } as unknown as MediaStream;

        stopAudioTracks(stream);

        expect(tracks[0].stop).toHaveBeenCalledOnce();
        expect(tracks[1].stop).toHaveBeenCalledOnce();
    });
});

describe("attachRemoteAudioStream", () => {
    it("plays the received stream directly on the audio element", () => {
        const stream = {} as MediaStream;
        const audioElement = {
            autoplay: false,
            srcObject: null,
            setAttribute: vi.fn(),
        } as unknown as HTMLAudioElement;

        attachRemoteAudioStream(audioElement, stream);

        expect(audioElement.srcObject).toBe(stream);
        expect(audioElement.autoplay).toBe(true);
        expect(audioElement.setAttribute).toHaveBeenCalledWith(
            "playsinline",
            "true"
        );
        expect(audioElement.setAttribute).toHaveBeenCalledWith(
            "webkit-playsinline",
            "true"
        );
    });
});

describe("detachRemoteAudioElement", () => {
    it("detaches playback without stopping remote receiver tracks", () => {
        const stop = vi.fn();
        const stream = {
            getTracks: () => [{ stop }],
        } as unknown as MediaStream;
        const audioElement = {
            srcObject: stream,
            pause: vi.fn(),
            remove: vi.fn(),
        } as unknown as HTMLAudioElement;

        detachRemoteAudioElement(audioElement);

        expect(audioElement.pause).toHaveBeenCalledOnce();
        expect(audioElement.srcObject).toBeNull();
        expect(audioElement.remove).toHaveBeenCalledOnce();
        expect(stop).not.toHaveBeenCalled();
    });
});

describe("getMicrophoneCaptureLatency", () => {
    it("returns the browser-reported latency for the captured audio track", () => {
        const stream = {
            getAudioTracks: () => [{ getSettings: () => ({ latency: 0.012 }) }],
        } as unknown as MediaStream;

        expect(getMicrophoneCaptureLatency(stream)).toBe(0.012);
    });

    it("returns undefined when the browser does not expose capture latency", () => {
        const stream = {
            getAudioTracks: () => [{ getSettings: () => ({}) }],
        } as unknown as MediaStream;

        expect(getMicrophoneCaptureLatency(stream)).toBeUndefined();
    });
});

describe("getIncomingAudioDiagnostics", () => {
    it("summarizes audio jitter, buffer, playout, loss, and connection RTT", () => {
        const stats = [
            {
                id: "audio-inbound",
                type: "inbound-rtp",
                timestamp: 1000,
                kind: "audio",
                jitter: 0.003,
                packetsLost: 2,
                jitterBufferDelay: 0.042,
                jitterBufferEmittedCount: 20,
            },
            {
                id: "audio-playout",
                type: "media-playout",
                timestamp: 1000,
                totalPlayoutDelay: 0.1,
                totalSamplesCount: 20,
            },
            {
                id: "selected-pair",
                type: "candidate-pair",
                timestamp: 1000,
                state: "succeeded",
                nominated: true,
                currentRoundTripTime: 0.08,
            },
            {
                id: "video-inbound",
                type: "inbound-rtp",
                timestamp: 1000,
                kind: "video",
                jitter: 0.2,
                packetsLost: 99,
            },
        ];

        expect(getIncomingAudioDiagnostics(stats)).toEqual({
            jitterMs: 3,
            packetsLost: 2,
            averageJitterBufferMs: 2.1,
            averagePlayoutDelayMs: 5,
            roundTripTimeMs: 80,
        });
    });

    it("returns an empty summary when audio diagnostics are unavailable", () => {
        expect(
            getIncomingAudioDiagnostics([
                {
                    id: "video-inbound",
                    type: "inbound-rtp",
                    timestamp: 1000,
                    kind: "video",
                },
            ])
        ).toEqual({});
    });
});
