"use client";

import { useState, useEffect, useCallback } from "react";

// Define the return type for our hook
type UseMicrophoneReturn = {
    isMicOn: boolean;
    mediaStream: MediaStream | null;
    error: string | null;
    permissionStatus: "granted" | "denied" | "prompt" | "unsupported";
    startMicrophone: () => Promise<MediaStream | void>;
    stopMicrophone: () => void;
};

/**
 * Custom hook to handle microphone access
 *
 * This hook abstracts the logic for accessing the device microphone,
 * handling permissions, and managing the MediaStream.
 */
export function useMicrophone(): UseMicrophoneReturn {
    const [isMicOn, setIsMicOn] = useState<boolean>(false);
    const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [permissionStatus, setPermissionStatus] = useState<
        "granted" | "denied" | "prompt" | "unsupported"
    >("prompt");

    // Check for browser support and permission status on mount
    useEffect(() => {
        const checkMicrophoneSupport = async () => {
            try {
                // First check if the browser supports getUserMedia
                if (
                    !navigator.mediaDevices ||
                    !navigator.mediaDevices.getUserMedia
                ) {
                    console.log("Browser doesn't support getUserMedia");
                    setPermissionStatus("unsupported");
                    return;
                }

                // Try to check permissions using the Permissions API
                if (navigator.permissions && navigator.permissions.query) {
                    try {
                        const status = await navigator.permissions.query({
                            name: "microphone" as PermissionName,
                        });

                        setPermissionStatus(
                            status.state as "granted" | "denied" | "prompt"
                        );

                        // Listen for permission changes
                        status.addEventListener("change", () => {
                            setPermissionStatus(
                                status.state as "granted" | "denied" | "prompt"
                            );

                            // If permission is revoked while mic is on, turn it off
                            if (status.state === "denied" && isMicOn) {
                                stopMicrophone();
                            }
                        });
                    } catch (permError) {
                        console.log("Permissions API error:", permError);
                        // Fall back to a prompt state if Permissions API fails but getUserMedia is available
                        setPermissionStatus("prompt");
                    }
                } else {
                    // Browser supports getUserMedia but not the Permissions API
                    // We'll set it to prompt and let the actual getUserMedia request determine the real state
                    console.log(
                        "Permissions API not available, but getUserMedia is supported"
                    );
                    setPermissionStatus("prompt");
                }
            } catch (error) {
                console.error("Error checking microphone permission:", error);
                setPermissionStatus("prompt");
            }
        };

        checkMicrophoneSupport();

        // Clean up event listeners on unmount
        return () => {
            if (mediaStream) {
                stopMicrophone();
            }
        };
    }, []);

    // Function to start the microphone
    const startMicrophone = useCallback(async () => {
        setError(null);

        try {
            if (permissionStatus === "unsupported") {
                throw new Error(
                    "Your browser doesn't support microphone access"
                );
            } // Updated audio constraints with balanced quality and latency
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true, // Enable echo cancellation to reduce feedback
                    noiseSuppression: true, // Enable noise suppression to reduce background noise
                    autoGainControl: true, // Enable auto gain to maintain consistent volume
                    sampleRate: 44100, // Standard sample rate with good quality/performance balance
                    channelCount: 1, // Mono is sufficient for voice and has less overhead
                },
            });
            setMediaStream(stream);
            setIsMicOn(true);
            setPermissionStatus("granted");

            // Add track ended event listener
            stream.getAudioTracks().forEach((track) => {
                track.addEventListener("ended", () => {
                    console.log("Audio track ended");
                    setIsMicOn(false);
                    setMediaStream(null);
                });
            });

            return stream;
        } catch (err: any) {
            console.error("Error starting microphone:", err);

            // Handle different error types
            if (
                err.name === "NotAllowedError" ||
                err.name === "PermissionDeniedError"
            ) {
                setPermissionStatus("denied");
                setError("Microphone permission denied");
            } else if (
                err.name === "NotFoundError" ||
                err.name === "DevicesNotFoundError"
            ) {
                setError("No microphone found");
            } else {
                setError(err.message || "Failed to access microphone");
            }

            setIsMicOn(false);
            setMediaStream(null);
            throw err;
        }
    }, [permissionStatus]);

    // Function to stop the microphone
    const stopMicrophone = useCallback(() => {
        if (mediaStream) {
            mediaStream.getTracks().forEach((track) => {
                track.stop();
            });
            setMediaStream(null);
        }
        setIsMicOn(false);
    }, [mediaStream]);

    return {
        isMicOn,
        mediaStream,
        error,
        permissionStatus,
        startMicrophone,
        stopMicrophone,
    };
}

export default useMicrophone;
