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
