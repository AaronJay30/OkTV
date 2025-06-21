"use client";

/**
 * Audio Optimization Service
 *
 * This service provides utilities for optimizing audio streams for low latency,
 * particularly useful for karaoke-style applications where synchronization with
 * music is critical.
 */

interface AudioProcessingOptions {
    bufferSize?: number;
    echoCancellation?: boolean;
    noiseSuppression?: boolean;
    autoGainControl?: boolean;
}

/**
 * Creates an optimized audio stream for low-latency scenarios
 * @param originalStream The original media stream
 * @param options Audio processing options
 * @returns A new MediaStream with optimized audio
 */
export function createLowLatencyAudioStream(
    originalStream: MediaStream,
    options: AudioProcessingOptions = {}
): MediaStream {
    // Create audio context with low latency settings
    const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)({
        latencyHint: "interactive", // Prioritize low latency
        sampleRate: 48000, // Higher sample rate can improve quality
    });

    // Get audio track from original stream
    const audioTrack = originalStream.getAudioTracks()[0];
    if (!audioTrack) {
        console.warn("No audio track found in the original stream");
        return originalStream;
    }

    // Create source from the audio track
    const streamSource = audioContext.createMediaStreamSource(originalStream);

    // Use default buffer size or specified one
    const bufferSize = options.bufferSize || 256; // Smaller buffer = lower latency but may have dropouts

    // Create script processor for custom audio processing
    // Note: ScriptProcessorNode is deprecated but still works in all browsers,
    // while AudioWorklet is newer but has less consistent browser support
    const scriptProcessor = audioContext.createScriptProcessor(
        bufferSize,
        1, // Number of input channels
        1 // Number of output channels
    );

    // Simple pass-through processing with minimal overhead
    scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
        const inputBuffer = audioProcessingEvent.inputBuffer;
        const outputBuffer = audioProcessingEvent.outputBuffer;

        // Get the channel data
        const inputData = inputBuffer.getChannelData(0);
        const outputData = outputBuffer.getChannelData(0);

        // Simple direct copy from input to output (no processing for minimal latency)
        for (let i = 0; i < inputBuffer.length; i++) {
            outputData[i] = inputData[i];
        }
    };

    // Connect the audio nodes
    streamSource.connect(scriptProcessor);

    // Create a destination to output the processed audio
    const streamDestination = audioContext.createMediaStreamDestination();
    scriptProcessor.connect(streamDestination);

    // Create a new media stream with the processed audio
    const processedStream = new MediaStream();

    // Add the processed audio track to the new stream
    streamDestination.stream.getAudioTracks().forEach((track) => {
        processedStream.addTrack(track);
    });

    // Keep reference to audioContext to prevent garbage collection
    (processedStream as any)._audioContext = audioContext;
    (processedStream as any)._scriptProcessor = scriptProcessor;

    return processedStream;
}

/**
 * Applies WebRTC-specific optimizations to a peer connection for low-latency audio
 * @param peerConnection The RTCPeerConnection to optimize
 */
export function optimizePeerConnectionForAudio(
    peerConnection: RTCPeerConnection
): void {
    // Set SDPs parameters for low latency
    const originalSetLocalDescription =
        peerConnection.setLocalDescription.bind(peerConnection);
    peerConnection.setLocalDescription = async function (
        description: RTCSessionDescriptionInit
    ) {
        // Modify SDP to prioritize audio quality and low latency
        if (description && description.sdp) {
            // Set Opus parameters for low latency
            description.sdp = description.sdp.replace(
                /a=fmtp:111 /g,
                "a=fmtp:111 minptime=10;useinbandfec=1;stereo=0;sprop-stereo=0;cbr=1;maxaveragebitrate=128000;maxplaybackrate=48000;ptime=20;maxptime=20;"
            );
        }
        return originalSetLocalDescription(description);
    };

    // We can do the same for remote description
    const originalSetRemoteDescription =
        peerConnection.setRemoteDescription.bind(peerConnection);
    peerConnection.setRemoteDescription = async function (
        description: RTCSessionDescriptionInit
    ) {
        // Modify SDP to prioritize audio quality and low latency
        if (description && description.sdp) {
            // Set Opus parameters for low latency
            description.sdp = description.sdp.replace(
                /a=fmtp:111 /g,
                "a=fmtp:111 minptime=10;useinbandfec=1;stereo=0;sprop-stereo=0;cbr=1;maxaveragebitrate=128000;maxplaybackrate=48000;ptime=20;maxptime=20;"
            );
        }
        return originalSetRemoteDescription(description);
    };
}
