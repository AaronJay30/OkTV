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
    // Create audio context with balanced latency and quality settings
    const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)({
        latencyHint: "balanced", // Balance between latency and stability
        sampleRate: 44100, // Standard sample rate with good quality/performance balance
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
    const bufferSize = options.bufferSize || 1024; // Larger buffer for better stability

    // Create script processor for custom audio processing
    // Note: ScriptProcessorNode is deprecated but still works in all browsers,
    // while AudioWorklet is newer but has less consistent browser support
    const scriptProcessor = audioContext.createScriptProcessor(
        bufferSize,
        1, // Number of input channels
        1 // Number of output channels
    );

    // Audio processing with simple noise gate to reduce static
    scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
        const inputBuffer = audioProcessingEvent.inputBuffer;
        const outputBuffer = audioProcessingEvent.outputBuffer;

        // Get the channel data
        const inputData = inputBuffer.getChannelData(0);
        const outputData = outputBuffer.getChannelData(0);

        // Simple noise gate to reduce static
        const noiseFloor = 0.01; // Threshold below which we consider it noise

        for (let i = 0; i < inputBuffer.length; i++) {
            // Apply a simple noise gate - if signal is below threshold, reduce it
            if (Math.abs(inputData[i]) < noiseFloor) {
                outputData[i] = 0; // Silence noise below threshold
            } else {
                outputData[i] = inputData[i]; // Keep signal above threshold
            }
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
        // Modify SDP to prioritize audio quality and stability
        if (description && description.sdp) {
            // Set Opus parameters for better audio quality
            description.sdp = description.sdp.replace(
                /a=fmtp:111 /g,
                "a=fmtp:111 minptime=10;useinbandfec=1;stereo=0;sprop-stereo=0;cbr=1;maxaveragebitrate=64000;maxplaybackrate=48000;ptime=20;maxptime=40;"
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
        // Modify SDP to prioritize audio quality and stability
        if (description && description.sdp) {
            // Set Opus parameters for better audio quality
            description.sdp = description.sdp.replace(
                /a=fmtp:111 /g,
                "a=fmtp:111 minptime=10;useinbandfec=1;stereo=0;sprop-stereo=0;cbr=1;maxaveragebitrate=64000;maxplaybackrate=48000;ptime=20;maxptime=40;"
            );
        }
        return originalSetRemoteDescription(description);
    };
}
