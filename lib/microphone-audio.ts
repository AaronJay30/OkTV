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
