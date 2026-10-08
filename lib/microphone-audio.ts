export function getMicrophoneAudioConstraints(): MediaTrackConstraints {
    return {
        echoCancellation: { ideal: true },
        noiseSuppression: { ideal: false },
        autoGainControl: { ideal: false },
    };
}

export function addMicrophoneTracks(
    peerConnection: Pick<RTCPeerConnection, "addTrack">,
    stream: MediaStream
): void {
    stream.getAudioTracks().forEach((track) => {
        peerConnection.addTrack(track, stream);
    });
}

export function stopAudioTracks(
    stream: Pick<MediaStream, "getTracks">
): void {
    stream.getTracks().forEach((track) => track.stop());
}

export function attachRemoteAudioStream(
    audioElement: HTMLAudioElement,
    stream: MediaStream
): void {
    audioElement.autoplay = true;
    audioElement.setAttribute("playsinline", "true");
    audioElement.setAttribute("webkit-playsinline", "true");
    audioElement.srcObject = stream;
}

export function detachRemoteAudioElement(
    audioElement: HTMLAudioElement
): void {
    audioElement.pause();
    audioElement.srcObject = null;
    audioElement.remove();
}

export function normalizeMicEchoLevel(level: number): number {
    return Number.isFinite(level)
        ? Math.round(Math.max(0, Math.min(100, level)))
        : 0;
}

export const DEFAULT_MIC_VOLUME_LEVEL = 80;

export function normalizeMicVolumeLevel(level: number): number {
    return Number.isFinite(level)
        ? Math.round(Math.max(0, Math.min(100, level)))
        : 0;
}

export function micVolumeLevelToGain(level: number): number {
    return normalizeMicVolumeLevel(level) / 100;
}

export function createMicrophoneEchoEffect(
    audioContext: AudioContext,
    stream: MediaStream
): {
    setLevel: (level: number, outputVolume?: number) => void;
    disconnect: () => void;
} {
    const source = audioContext.createMediaStreamSource(stream);
    const delay = audioContext.createDelay(1);
    const feedback = audioContext.createGain();
    const wet = audioContext.createGain();

    delay.delayTime.value = 0.22;
    source.connect(delay);
    delay.connect(wet);
    wet.connect(audioContext.destination);
    delay.connect(feedback);
    feedback.connect(delay);

    return {
        setLevel(level, outputVolume = 1) {
            const amount = normalizeMicEchoLevel(level) / 100;
            const safeVolume = Number.isFinite(outputVolume)
                ? Math.max(0, Math.min(1, outputVolume))
                : 0;
            wet.gain.setTargetAtTime(
                amount * 0.55 * safeVolume,
                audioContext.currentTime,
                0.03
            );
            feedback.gain.setTargetAtTime(
                amount * 0.38,
                audioContext.currentTime,
                0.03
            );
        },
        disconnect() {
            source.disconnect();
            delay.disconnect();
            feedback.disconnect();
            wet.disconnect();
        },
    };
}

export function getMicrophoneCaptureLatency(
    stream: Pick<MediaStream, "getAudioTracks">
): number | undefined {
    const settings = stream
        .getAudioTracks()[0]
        ?.getSettings() as (MediaTrackSettings & { latency?: number }) | undefined;
    return settings?.latency;
}

export interface IncomingAudioDiagnostics {
    jitterMs?: number;
    packetsLost?: number;
    averageJitterBufferMs?: number;
    averagePlayoutDelayMs?: number;
    roundTripTimeMs?: number;
}

interface AudioStatsEntry {
    type: string;
    kind?: string;
    mediaType?: string;
    state?: string;
    nominated?: boolean;
    jitter?: number;
    packetsLost?: number;
    jitterBufferDelay?: number;
    jitterBufferEmittedCount?: number;
    totalPlayoutDelay?: number;
    totalSamplesCount?: number;
    currentRoundTripTime?: number;
}

function secondsToMilliseconds(seconds: number): number {
    return Math.round(seconds * 1000 * 10) / 10;
}

export function getIncomingAudioDiagnostics(
    stats: Iterable<unknown>
): IncomingAudioDiagnostics {
    let inboundAudio: AudioStatsEntry | undefined;
    let audioPlayout: AudioStatsEntry | undefined;
    let selectedCandidatePair: AudioStatsEntry | undefined;

    for (const stat of stats) {
        const entry = stat as AudioStatsEntry;
        if (
            entry.type === "inbound-rtp" &&
            (entry.kind === "audio" || entry.mediaType === "audio")
        ) {
            inboundAudio = entry;
        } else if (entry.type === "media-playout") {
            audioPlayout = entry;
        } else if (
            entry.type === "candidate-pair" &&
            entry.state === "succeeded" &&
            entry.nominated !== false &&
            entry.currentRoundTripTime !== undefined
        ) {
            selectedCandidatePair = entry;
        }
    }

    const diagnostics: IncomingAudioDiagnostics = {};
    if (inboundAudio?.jitter !== undefined) {
        diagnostics.jitterMs = secondsToMilliseconds(inboundAudio.jitter);
    }
    if (inboundAudio?.packetsLost !== undefined) {
        diagnostics.packetsLost = inboundAudio.packetsLost;
    }
    if (
        inboundAudio?.jitterBufferDelay !== undefined &&
        inboundAudio.jitterBufferEmittedCount
    ) {
        diagnostics.averageJitterBufferMs = secondsToMilliseconds(
            inboundAudio.jitterBufferDelay /
                inboundAudio.jitterBufferEmittedCount
        );
    }
    if (
        audioPlayout?.totalPlayoutDelay !== undefined &&
        audioPlayout.totalSamplesCount
    ) {
        diagnostics.averagePlayoutDelayMs = secondsToMilliseconds(
            audioPlayout.totalPlayoutDelay / audioPlayout.totalSamplesCount
        );
    }
    if (selectedCandidatePair?.currentRoundTripTime !== undefined) {
        diagnostics.roundTripTimeMs = secondsToMilliseconds(
            selectedCandidatePair.currentRoundTripTime
        );
    }

    return diagnostics;
}
