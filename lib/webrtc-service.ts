"use client";

import {
    onValue,
    ref,
    set,
    remove,
    push,
    get,
    query,
    orderByChild,
    equalTo,
    off,
} from "firebase/database";
import { rtdb } from "./firebase";

/**
 * Signal types for WebRTC communication
 */
export type SignalType =
    | "offer"
    | "answer"
    | "ice-candidate"
    | "admin-mute"
    | "admin-unmute";

/**
 * Signal interface for WebRTC communication
 */
interface Signal {
    from: string;
    to: string;
    type: SignalType;
    payload: any;
    timestamp: number;
}

/**
 * Creates an RTCPeerConnection with the appropriate configuration
 */
export function createPeerConnection(): RTCPeerConnection {
    const configuration: RTCConfiguration = {
        iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
            { urls: "stun:stun2.l.google.com:19302" },
        ],
        iceCandidatePoolSize: 10,
    };

    return new RTCPeerConnection(configuration);
}

/**
 * Creates an offer for a peer connection
 * @param peerConnection The RTCPeerConnection instance
 * @returns The session description for the offer
 */
export async function createOffer(
    peerConnection: RTCPeerConnection
): Promise<RTCSessionDescriptionInit> {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    return offer;
}

/**
 * Handles an incoming offer by setting the remote description and creating an answer
 * @param peerConnection The RTCPeerConnection instance
 * @param offer The incoming offer (session description)
 * @returns The session description for the answer
 */
export async function handleOffer(
    peerConnection: RTCPeerConnection,
    offer: RTCSessionDescriptionInit
): Promise<RTCSessionDescriptionInit> {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    return answer;
}

/**
 * Handles an incoming answer by setting the remote description
 * @param peerConnection The RTCPeerConnection instance
 * @param answer The incoming answer (session description)
 */
export async function handleAnswer(
    peerConnection: RTCPeerConnection,
    answer: RTCSessionDescriptionInit
): Promise<void> {
    await peerConnection.setRemoteDescription(
        new RTCSessionDescription(answer)
    );
}

/**
 * Handles an incoming ICE candidate
 * @param peerConnection The RTCPeerConnection instance
 * @param candidate The ICE candidate
 */
export async function handleIceCandidate(
    peerConnection: RTCPeerConnection,
    candidate: RTCIceCandidateInit
): Promise<void> {
    try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
        console.error("Error adding ICE candidate:", error);
    }
}

/**
 * Sends a WebRTC signal to a peer
 * @param roomId The ID of the room
 * @param from The ID of the sender
 * @param to The ID of the recipient
 * @param type The type of signal
 * @param payload The signal payload
 * @returns The ID of the signal
 */
export async function sendSignal(
    roomId: string,
    from: string,
    to: string,
    type: SignalType,
    payload: any
): Promise<string> {
    const signalRef = ref(rtdb, `rooms/${roomId}/webrtc_signals`);
    const signal: Signal = {
        from,
        to,
        type,
        payload,
        timestamp: Date.now(),
    };

    const newSignalRef = push(signalRef);
    await set(newSignalRef, signal);
    return newSignalRef.key || "";
}

/**
 * Listens for incoming signals for a specific user
 * @param roomId The ID of the room
 * @param userId The ID of the user to listen for
 * @param callback The callback function to handle incoming signals
 */
export function listenForSignals(
    roomId: string,
    userId: string,
    callback: (signal: Signal) => void
): () => void {
    const signalsRef = ref(rtdb, `rooms/${roomId}/webrtc_signals`);

    // Create a query to only get signals for this user
    const userSignalsQuery = query(
        signalsRef,
        orderByChild("to"),
        equalTo(userId)
    );

    // Listen for new signals
    const unsubscribe = onValue(userSignalsQuery, (snapshot) => {
        if (!snapshot.exists()) return;

        snapshot.forEach((childSnapshot) => {
            const signal = childSnapshot.val() as Signal;
            callback(signal);

            // Remove the signal once it's processed
            remove(childSnapshot.ref).catch((err) =>
                console.error("Error removing processed signal:", err)
            );
        });
    });

    // Return a function to unsubscribe
    return () => {
        off(userSignalsQuery);
    };
}

/**
 * Check if microphone feature is enabled for a room
 * @param roomId The ID of the room
 * @returns Whether the microphone feature is enabled
 */
export async function isMicrophoneFeatureEnabled(
    roomId: string
): Promise<boolean> {
    const roomRef = ref(rtdb, `rooms/${roomId}`);
    const snapshot = await get(roomRef);

    if (snapshot.exists()) {
        const room = snapshot.val();
        return !!room.micFeatureEnabled;
    }

    return false;
}

/**
 * Updates a user's microphone status in Firebase
 * @param roomId The ID of the room
 * @param userId The ID of the user
 * @param isMicOn Whether the microphone is on
 */
export async function updateUserMicStatus(
    roomId: string,
    userId: string,
    isMicOn: boolean
): Promise<void> {
    const userRef = ref(rtdb, `rooms/${roomId}/users/${userId}`);
    const snapshot = await get(userRef);

    if (snapshot.exists()) {
        const userData = snapshot.val();
        await set(userRef, { ...userData, isMicOn });
    }
}

/**
 * Updates a user's muted status in Firebase (admin only)
 * @param roomId The ID of the room
 * @param userId The ID of the user
 * @param isMutedByAdmin Whether the user is muted by the admin
 */
export async function updateUserMutedStatus(
    roomId: string,
    userId: string,
    isMutedByAdmin: boolean
): Promise<void> {
    const userRef = ref(rtdb, `rooms/${roomId}/users/${userId}`);
    const snapshot = await get(userRef);

    if (snapshot.exists()) {
        const userData = snapshot.val();
        await set(userRef, { ...userData, isMutedByAdmin });
    }
}

/**
 * Class to manage the WebRTC connection for a microphone
 */
export class MicrophoneRTCManager {
    private peerConnection: RTCPeerConnection | null = null;
    private roomId: string;
    private userId: string;
    private adminId: string = "admin";
    private localStream: MediaStream | null = null;
    private unsubscribeFromSignals: (() => void) | null = null;
    private onMutedCallback: ((isMuted: boolean) => void) | null = null;

    constructor(roomId: string, userId: string) {
        this.roomId = roomId;
        this.userId = userId;
    }

    /**
     * Sets the callback for when the user is muted/unmuted by the admin
     * @param callback The callback function
     */
    public setOnMutedCallback(callback: (isMuted: boolean) => void): void {
        this.onMutedCallback = callback;
    }
    /**
     * Initializes the WebRTC connection with a media stream
     * @param stream The media stream to send
     */
    public async initialize(stream: MediaStream): Promise<void> {
        // First check if the user is currently muted by the admin
        const userRef = ref(rtdb, `rooms/${this.roomId}/users/${this.userId}`);
        const snapshot = await get(userRef);

        if (snapshot.exists()) {
            const userData = snapshot.val();
            if (userData.isMutedByAdmin) {
                // If the user is muted by admin, don't allow initializing the connection
                throw new Error(
                    "You have been muted by the host and cannot turn on your microphone"
                );
            }
        }

        this.localStream = stream;
        this.peerConnection = createPeerConnection();

        // Add all tracks from the stream to the peer connection
        stream.getTracks().forEach((track) => {
            if (this.peerConnection && this.localStream) {
                this.peerConnection.addTrack(track, this.localStream);
            }
        });

        // Listen for ICE candidates and send them to the admin
        this.peerConnection.onicecandidate = async (event) => {
            if (event.candidate) {
                await sendSignal(
                    this.roomId,
                    this.userId,
                    this.adminId,
                    "ice-candidate",
                    event.candidate.toJSON()
                );
            }
        };

        // Listen for connection state changes
        this.peerConnection.onconnectionstatechange = () => {
            console.log(
                `Connection state changed: ${this.peerConnection?.connectionState}`
            );
        };

        // Listen for signals from the admin
        this.startListeningForSignals();

        // Create and send an offer to the admin
        const offer = await createOffer(this.peerConnection);
        await sendSignal(
            this.roomId,
            this.userId,
            this.adminId,
            "offer",
            offer
        );

        // Update user's mic status in Firebase
        await updateUserMicStatus(this.roomId, this.userId, true);
    }
    /**
     * Starts listening for signals from other peers
     */
    private startListeningForSignals(): void {
        this.unsubscribeFromSignals = listenForSignals(
            this.roomId,
            this.userId,
            async (signal) => {
                if (!this.peerConnection) return;

                switch (signal.type) {
                    case "answer":
                        await handleAnswer(this.peerConnection, signal.payload);
                        break;
                    case "ice-candidate":
                        await handleIceCandidate(
                            this.peerConnection,
                            signal.payload
                        );
                        break;
                    case "admin-mute":
                        if (this.onMutedCallback) {
                            this.onMutedCallback(true);

                            // When admin mutes the user, completely stop the microphone tracks
                            if (this.localStream) {
                                this.localStream
                                    .getTracks()
                                    .forEach((track) => {
                                        track.stop(); // Completely stop tracks, not just disable
                                    });
                                this.localStream = null; // Clear the stream reference
                            }

                            // Update the user's mic status in Firebase to be off
                            updateUserMicStatus(
                                this.roomId,
                                this.userId,
                                false
                            ).catch((err) =>
                                console.error("Error updating mic status:", err)
                            );

                            // Close the peer connection to ensure complete disconnection
                            if (this.peerConnection) {
                                this.peerConnection.close();
                                this.peerConnection = null;
                            }
                        }
                        break;
                    case "admin-unmute":
                        if (this.onMutedCallback) {
                            this.onMutedCallback(false);

                            // When admin unmutes, we don't automatically restart the mic
                            // Instead, we notify the user they've been unmuted
                            // and they need to manually turn on their mic
                            // The actual microphone restart will be handled in the UI
                        }
                        break;
                }
            }
        );
    }

    /**
     * Closes the WebRTC connection and cleans up resources
     */
    public async close(): Promise<void> {
        // Stop listening for signals
        if (this.unsubscribeFromSignals) {
            this.unsubscribeFromSignals();
            this.unsubscribeFromSignals = null;
        }

        // Close the peer connection
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }

        // Update user's mic status in Firebase
        await updateUserMicStatus(this.roomId, this.userId, false);
    }
}

/**
 * Class to manage admin-side WebRTC connections for multiple users
 */
export class AdminRTCManager {
    private peerConnections: Map<string, RTCPeerConnection> = new Map();
    private roomId: string;
    private adminId: string = "admin";
    private userStreams: Map<string, MediaStream> = new Map();
    private unsubscribeFromSignals: (() => void) | null = null;
    private onUserStreamCallback:
        | ((
              userId: string,
              stream: MediaStream | null,
              event: "add" | "remove"
          ) => void)
        | null = null;

    constructor(roomId: string) {
        this.roomId = roomId;
    }

    /**
     * Sets the callback for when a user's stream is added or removed
     * @param callback The callback function
     */
    public setOnUserStreamCallback(
        callback: (
            userId: string,
            stream: MediaStream | null,
            event: "add" | "remove"
        ) => void
    ): void {
        this.onUserStreamCallback = callback;
    }

    /**
     * Initializes the admin RTC manager
     */
    public async initialize(): Promise<void> {
        // Listen for signals from users
        this.startListeningForSignals();
    }

    /**
     * Starts listening for signals from users
     */
    private startListeningForSignals(): void {
        this.unsubscribeFromSignals = listenForSignals(
            this.roomId,
            this.adminId,
            async (signal) => {
                const { from: userId, type, payload } = signal;

                switch (type) {
                    case "offer":
                        await this.handleUserOffer(userId, payload);
                        break;
                    case "ice-candidate":
                        await this.handleUserIceCandidate(userId, payload);
                        break;
                }
            }
        );
    }

    /**
     * Handles an offer from a user
     * @param userId The ID of the user
     * @param offer The offer from the user
     */
    private async handleUserOffer(
        userId: string,
        offer: RTCSessionDescriptionInit
    ): Promise<void> {
        // Create a new peer connection for this user if one doesn't exist
        if (!this.peerConnections.has(userId)) {
            const peerConnection = createPeerConnection();
            this.peerConnections.set(userId, peerConnection);

            // Set up event handlers for this connection
            peerConnection.ontrack = (event) => {
                const [stream] = event.streams;
                this.userStreams.set(userId, stream);

                if (this.onUserStreamCallback) {
                    this.onUserStreamCallback(userId, stream, "add");
                }
            };

            peerConnection.onicecandidate = async (event) => {
                if (event.candidate) {
                    await sendSignal(
                        this.roomId,
                        this.adminId,
                        userId,
                        "ice-candidate",
                        event.candidate.toJSON()
                    );
                }
            };

            peerConnection.onconnectionstatechange = () => {
                if (
                    peerConnection.connectionState === "disconnected" ||
                    peerConnection.connectionState === "failed" ||
                    peerConnection.connectionState === "closed"
                ) {
                    this.removeUserConnection(userId);
                }
            };
        }

        const peerConnection = this.peerConnections.get(userId)!;
        const answer = await handleOffer(peerConnection, offer);

        // Send the answer back to the user
        await sendSignal(this.roomId, this.adminId, userId, "answer", answer);
    }

    /**
     * Handles an ICE candidate from a user
     * @param userId The ID of the user
     * @param candidate The ICE candidate
     */
    private async handleUserIceCandidate(
        userId: string,
        candidate: RTCIceCandidateInit
    ): Promise<void> {
        const peerConnection = this.peerConnections.get(userId);
        if (peerConnection) {
            await handleIceCandidate(peerConnection, candidate);
        }
    }
    /**
     * Mutes a user
     * @param userId The ID of the user to mute
     */
    public async muteUser(userId: string): Promise<void> {
        try {
            // Send a mute signal to the user
            await sendSignal(
                this.roomId,
                this.adminId,
                userId,
                "admin-mute",
                {}
            );

            // Update the user's muted status in Firebase
            await updateUserMutedStatus(this.roomId, userId, true);

            // Also update the user's mic status to be off in Firebase
            // This ensures they can't turn it back on while muted
            await updateUserMicStatus(this.roomId, userId, false);

            // Stop the audio playback for this user on the admin side
            const audioElement = document.getElementById(
                `audio-${userId}`
            ) as HTMLAudioElement;
            if (audioElement) {
                // Pause and remove the audio element
                audioElement.pause();
                if (audioElement.srcObject) {
                    const stream = audioElement.srcObject as MediaStream;
                    stream.getTracks().forEach((track) => track.stop());
                }
                audioElement.srcObject = null;
                audioElement.remove();
            }

            // Close and recreate the peer connection to ensure complete disconnection
            this.removeUserConnection(userId);
        } catch (error) {
            console.error("Error muting user:", error);
            throw error;
        }
    }
    /**
     * Unmutes a user
     * @param userId The ID of the user to unmute
     */
    public async unmuteUser(userId: string): Promise<void> {
        try {
            // Send an unmute signal to the user
            await sendSignal(
                this.roomId,
                this.adminId,
                userId,
                "admin-unmute",
                {}
            );

            // Update the user's muted status in Firebase
            await updateUserMutedStatus(this.roomId, userId, false);

            // Note: We don't automatically turn the user's mic on
            // They need to manually turn it back on after being unmuted
        } catch (error) {
            console.error("Error unmuting user:", error);
            throw error;
        }
    }

    /**
     * Removes a user's connection
     * @param userId The ID of the user
     */
    private removeUserConnection(userId: string): void {
        const peerConnection = this.peerConnections.get(userId);
        if (peerConnection) {
            peerConnection.close();
            this.peerConnections.delete(userId);
        }

        const stream = this.userStreams.get(userId);
        if (stream) {
            stream.getTracks().forEach((track) => track.stop());
            this.userStreams.delete(userId);

            if (this.onUserStreamCallback) {
                this.onUserStreamCallback(userId, null, "remove");
            }
        }
    }

    /**
     * Sets the volume for a specific user's audio stream
     * @param userId The ID of the user
     * @param volume The volume level (0-1)
     */
    public setUserVolume(userId: string, volume: number): void {
        // Find the audio element for this user and adjust its volume
        const audioElement = document.getElementById(
            `audio-${userId}`
        ) as HTMLAudioElement;

        if (audioElement) {
            // Ensure volume is between 0 and 1
            const safeVolume = Math.max(0, Math.min(1, volume));
            audioElement.volume = safeVolume;
        }
    }

    /**
     * Cleans up all connections and listeners
     */
    public close(): void {
        // Stop listening for signals
        if (this.unsubscribeFromSignals) {
            this.unsubscribeFromSignals();
            this.unsubscribeFromSignals = null;
        }

        // Close all peer connections
        for (const [userId, peerConnection] of this.peerConnections.entries()) {
            peerConnection.close();
            if (this.onUserStreamCallback) {
                this.onUserStreamCallback(userId, null, "remove");
            }
        }

        // Clear the maps
        this.peerConnections.clear();
        this.userStreams.clear();
    }
}
