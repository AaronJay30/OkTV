import { describe, expect, it, vi } from "vitest";
import {
    addMicrophoneTracks,
    attachRemoteAudioStream,
    detachRemoteAudioElement,
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
