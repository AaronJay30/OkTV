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
