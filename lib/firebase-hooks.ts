// lib/firebase-hooks.ts
import { useState, useEffect, useRef } from "react";
import {
    onValue,
    ref,
    get,
    off,
    query,
    orderByChild,
    DataSnapshot,
    DatabaseReference,
    set,
    update,
    remove,
} from "firebase/database";
import { rtdb } from "./firebase";
import type { Song, User, Room } from "@/types/room";

// Custom hook for reliable real-time Firebase data subscription
export function useFirebaseValue<T>(
    path: string,
    defaultValue: T
): [T, boolean, Error | null] {
    const [value, setValue] = useState<T>(defaultValue);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<Error | null>(null);
    const initialLoadComplete = useRef<boolean>(false);
    const unsubscribeRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        // Prevent duplicate initialization
        if (path === "") return;

        setLoading(true);
        setError(null);
        initialLoadComplete.current = false;

        // Clean up any existing subscription
        if (unsubscribeRef.current) {
            unsubscribeRef.current();
            unsubscribeRef.current = null;
        }

        // Get database reference
        const dbRef = ref(rtdb, path);

        // Initial load - get the current value
        get(dbRef)
            .then((snapshot) => {
                if (snapshot.exists()) {
                    setValue(snapshot.val());
                } else {
                    setValue(defaultValue);
                }
                initialLoadComplete.current = true;
            })
            .catch((err) => {
                console.error(`Error getting initial data for ${path}:`, err);
                setError(err);
            })
            .finally(() => {
                setLoading(false);
            });

        // Set up real-time subscription with error retry logic
        const setupSubscription = () => {
            // Only set up subscription if not already subscribed
            if (unsubscribeRef.current) return;

            const onValueCallback = (snapshot: DataSnapshot) => {
                if (snapshot.exists()) {
                    setValue(snapshot.val());
                } else {
                    setValue(defaultValue);
                }

                if (loading) setLoading(false);
                if (error) setError(null);
            };

            const onError = (err: Error) => {
                console.error(
                    `Error in Firebase subscription for ${path}:`,
                    err
                );
                setError(err);

                // Attempt to reconnect after a short delay
                if (unsubscribeRef.current) {
                    unsubscribeRef.current();
                    unsubscribeRef.current = null;
                }

                setTimeout(() => {
                    setupSubscription();
                }, 3000); // Retry after 3 seconds
            };

            // Store the unsubscribe function
            unsubscribeRef.current = onValue(dbRef, onValueCallback, onError);
        };

        // Set up the initial subscription
        setupSubscription();

        // Clean up subscription when component unmounts or path changes
        return () => {
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
                unsubscribeRef.current = null;
            }
        };
    }, [path, defaultValue]);

    return [value, loading, error];
}

// Specific hook for queue with transformation to array format and sorting
export function useFirebaseQueue(
    roomId: string
): [Song[], boolean, Error | null] {
    const [queueData, loading, error] = useFirebaseValue<Record<
        string,
        Song
    > | null>(`rooms/${roomId}/queue`, null);
    const [songs, setSongs] = useState<Song[]>([]);

    useEffect(() => {
        if (queueData) {
            // Convert to array and add Firebase keys
            const songsArray = Object.entries(queueData).map(
                ([firebaseKey, song]) => ({
                    firebaseKey,
                    ...(song as Song),
                })
            );

            // Sort by addedAt if available
            songsArray.sort((a, b) => {
                if (!a.addedAt && !b.addedAt) return 0;
                if (!a.addedAt) return 1;
                if (!b.addedAt) return -1;
                return (
                    new Date(a.addedAt).getTime() -
                    new Date(b.addedAt).getTime()
                );
            });

            setSongs(songsArray);
        } else {
            setSongs([]);
        }
    }, [queueData]);

    return [songs, loading, error];
}

// Specific hook for current song
export function useFirebaseCurrentSong(
    roomId: string
): [Song | null, boolean, Error | null] {
    return useFirebaseValue<Song | null>(`rooms/${roomId}/currentSong`, null);
}

// Specific hook for player state
export function useFirebasePlayerState(
    roomId: string
): [{ isPlaying: boolean; isMuted: boolean }, boolean, Error | null] {
    const [roomData, loading, error] = useFirebaseValue<Room | null>(
        `rooms/${roomId}`,
        null
    );

    const playerState = {
        isPlaying: roomData?.isPlaying || false,
        isMuted: roomData?.isMuted || false,
    };

    return [playerState, loading, error];
} // Specific hook for users
export function useFirebaseUsers(
    roomId: string
): [User[], boolean, Error | null] {
    const [usersData, loading, error] = useFirebaseValue<Record<
        string,
        User
    > | null>(`rooms/${roomId}/users`, null);
    const [users, setUsers] = useState<User[]>([]);

    useEffect(() => {
        if (usersData) {
            const usersArray = Object.entries(usersData).map(
                ([userId, userData]) => ({
                    ...userData,
                    id: userId,
                })
            );

            // Sort by joinedAt if available
            usersArray.sort((a, b) => {
                if (!a.joinedAt && !b.joinedAt) return 0;
                if (!a.joinedAt) return 1;
                if (!b.joinedAt) return -1;
                return (
                    new Date(a.joinedAt).getTime() -
                    new Date(b.joinedAt).getTime()
                );
            });

            setUsers(usersArray);
        } else {
            setUsers([]);
        }
    }, [usersData]);

    return [users, loading, error];
}

// Hook for the entire room state
export function useFirebaseRoom(
    roomId: string
): [Room | null, boolean, Error | null] {
    return useFirebaseValue<Room | null>(`rooms/${roomId}`, null);
}

// Helper type for actions returned by useQueueAndCurrentSong
export interface QueueActions {
    handleSongEnded: () => Promise<void>;
    handleSkipSong: () => Promise<void>;
    handleRemoveSpecificSong: (
        songId: string,
        firebaseKey?: string
    ) => Promise<void>;
}

// Combined hook for queue and current song management
export function useQueueAndCurrentSong(
    roomId: string,
    isAdmin: boolean
): [
    {
        queue: Song[];
        currentSong: Song | null;
        isPlaying: boolean;
        isMuted: boolean;
    },
    boolean,
    Error | null,
    QueueActions // Changed from (songId: string, firebaseKey?: string) => Promise<void>
] {
    const [queue, queueLoading, queueError] = useFirebaseQueue(roomId);
    const [currentSong, currentSongLoading, currentSongError] =
        useFirebaseCurrentSong(roomId);
    const [playerState, playerStateLoading, playerStateError] =
        useFirebasePlayerState(roomId);
    const {
        updateCurrentSong: fbUpdateCurrentSong,
        updatePlayerState: fbUpdatePlayerState,
        removeSongFromQueue: fbRemoveSongFromQueue,
    } = useFirebaseActions(roomId);

    const loading = queueLoading || currentSongLoading || playerStateLoading;
    const error = queueError || currentSongError || playerStateError;

    const playNextSongFromPredictedQueue = async (predictedQueue: Song[]) => {
        if (predictedQueue.length > 0) {
            const nextSongToPlay = predictedQueue[0];
            await fbUpdateCurrentSong(nextSongToPlay);
            await fbUpdatePlayerState(true, playerState.isMuted);
        } else {
            await fbUpdateCurrentSong(null);
            await fbUpdatePlayerState(false, playerState.isMuted);
        }
    };

    const handleSongEnded = async () => {
        if (!isAdmin || !currentSong) {
            // If not admin, or no song was playing, do nothing or ensure player stops if no queue.
            if (!currentSong && queue.length === 0) {
                await fbUpdatePlayerState(false, playerState.isMuted);
            }
            return;
        }

        const songThatEndedKey = currentSong.firebaseKey || currentSong.id;
        await fbRemoveSongFromQueue(songThatEndedKey);

        const predictedQueue = queue.filter(
            (s) => (s.firebaseKey || s.id) !== songThatEndedKey
        );
        await playNextSongFromPredictedQueue(predictedQueue);
    };

    const handleSkipSong = async () => {
        if (!isAdmin) return;

        if (currentSong) {
            // Skipping the current song
            const songToSkipKey = currentSong.firebaseKey || currentSong.id;
            await fbRemoveSongFromQueue(songToSkipKey);
            const predictedQueue = queue.filter(
                (s) => (s.firebaseKey || s.id) !== songToSkipKey
            );
            await playNextSongFromPredictedQueue(predictedQueue);
        } else if (queue.length > 0) {
            // No current song, but queue has songs. Play the first one and remove it.
            // This makes "skip" also function as "play next from queue if stopped"
            const nextSongInQueue = queue[0];
            const keyToRemove =
                nextSongInQueue.firebaseKey || nextSongInQueue.id;
            await fbUpdateCurrentSong(nextSongInQueue); // Set as current
            await fbRemoveSongFromQueue(keyToRemove); // Remove from queue
            await fbUpdatePlayerState(true, playerState.isMuted); // Start playing
        } else {
            // No current song and empty queue
            await fbUpdateCurrentSong(null);
            await fbUpdatePlayerState(false, playerState.isMuted);
        }
    };

    const handleRemoveSpecificSong = async (
        songId: string,
        firebaseKey?: string
    ) => {
        // Admin check for this action will be handled by the caller (page.tsx)
        // or could be enforced here if desired: if (!isAdmin) return;

        const keyToRemove = firebaseKey || songId;
        const isRemovingCurrent =
            currentSong &&
            (currentSong.id === songId ||
                currentSong.firebaseKey === firebaseKey);

        await fbRemoveSongFromQueue(keyToRemove);

        if (isRemovingCurrent) {
            const predictedQueue = queue.filter(
                (s) => (s.firebaseKey || s.id) !== keyToRemove
            );
            await playNextSongFromPredictedQueue(predictedQueue);
        }
    };

    const combinedState = {
        queue,
        currentSong,
        isPlaying: playerState.isPlaying,
        isMuted: playerState.isMuted,
    };

    const actions: QueueActions = {
        handleSongEnded,
        handleSkipSong,
        handleRemoveSpecificSong,
    };

    return [combinedState, loading, error, actions];
}

// Hook for Firebase actions to avoid code duplication
export function useFirebaseActions(roomId: string) {
    const updateCurrentSong = async (song: Song | null): Promise<void> => {
        const songRef = ref(rtdb, `rooms/${roomId}/currentSong`);
        try {
            await set(songRef, song);
        } catch (error) {
            console.error("Error updating current song:", error);
            throw error;
        }
    };

    const updatePlayerState = async (
        isPlaying: boolean,
        isMuted: boolean
    ): Promise<void> => {
        const roomRef = ref(rtdb, `rooms/${roomId}`);
        try {
            await update(roomRef, {
                isPlaying,
                isMuted,
            });
        } catch (error) {
            console.error("Error updating player state:", error);
            throw error;
        }
    };

    const removeSongFromQueue = async (songId: string): Promise<void> => {
        const songRef = ref(rtdb, `rooms/${roomId}/queue/${songId}`);
        try {
            await remove(songRef);
        } catch (error) {
            console.error("Error removing song from queue:", error);
            throw error;
        }
    };

    return {
        updateCurrentSong,
        updatePlayerState,
        removeSongFromQueue,
    };
}
