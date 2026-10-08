import { describe, expect, it, vi } from "vitest";
import {
    addMicrophoneTracks,
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
