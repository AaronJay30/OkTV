// lib/firebase-service.ts
import {
    ref,
    set,
    onValue,
    push,
    remove,
    update,
    get,
    child,
    off,
    query,
    orderByChild,
    startAt,
    endAt,
    runTransaction,
} from "firebase/database";
import { rtdb } from "./firebase";
import type { Song, User, Score } from "@/types/room";
import { roomIsIdle } from "@/lib/admin-room";

// Function to check for and delete old rooms (more than 1 day old)
export const cleanupOldRooms = async (daysOld: number = 1): Promise<number> => {
    const roomsRef = ref(rtdb, "rooms");
    const snapshot = await get(roomsRef);

    if (!snapshot.exists()) {
        return 0;
    }

    const rooms = snapshot.val();
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - daysOld * 24 * 60 * 60 * 1000);
    let deletedCount = 0;

    for (const roomId in rooms) {
        if (rooms.hasOwnProperty(roomId)) {
            const room = rooms[roomId];

            const isOld = roomIsIdle(room, cutoffDate.getTime());

            // Check if room is older than specified days
            if (isOld) {
                // Room is older than specified days, delete it
                const roomRef = ref(rtdb, `rooms/${roomId}`);
                await remove(roomRef);
                deletedCount++;
            }
        }
    }
    return deletedCount;
};

// Room management
export const createRoom = async (
    roomId: string,
    adminUser: User,
    micFeatureEnabled: boolean = false,
    scorerEnabled: boolean = false
): Promise<void> => {
    // Clean up old rooms before creating a new one
    try {
        // Default to cleaning up rooms older than 1 day
        const deletedCount = await cleanupOldRooms(1);
    } catch (error) {
        console.error("Error cleaning up old rooms:", error);
        // Continue with room creation even if cleanup fails
    }

    const roomRef = ref(rtdb, `rooms/${roomId}`);
    // Use adminUser.id (which should be "admin") as the key for the admin user
    const adminUserPath = `rooms/${roomId}/users/${adminUser.id}`;
    const adminUserRef = ref(rtdb, adminUserPath);
    await set(roomRef, {
        createdAt: new Date().toISOString(),
        currentSong: null,
        isPlaying: false,
        isMuted: false,
        micFeatureEnabled: micFeatureEnabled,
        scorerEnabled: scorerEnabled,
    });

    // Add admin user directly with their specified ID
    // Ensure we are not nesting the 'id' field from adminUser object into the DB if it's already used as the key.
    await set(adminUserRef, {
        name: adminUser.name,
        isAdmin: adminUser.isAdmin,
        joinedAt: new Date().toISOString(),
    });
    // No longer calling addUserToRoom(roomId, adminUser);
};

export const checkRoomExists = async (roomId: string): Promise<boolean> => {
    const roomRef = ref(rtdb, `rooms/${roomId}`);
    const snapshot = await get(roomRef);
    return snapshot.exists();
};

/**
 * SECURITY: idempotently seed the admin user into an existing room.
 * Unlike createRoom, this does NOT overwrite room metadata, does NOT
 * reset feature flags, and does NOT run cleanupOldRooms. Use this on
 * admin re-mount / page reload when the room is already known to
 * exist (e.g. created via the home page's create flow).
 */
export const seedAdminUser = async (
    roomId: string,
    adminUser: User
): Promise<void> => {
    const adminUserRef = ref(rtdb, `rooms/${roomId}/users/${adminUser.id}`);
    await set(adminUserRef, {
        name: adminUser.name,
        isAdmin: adminUser.isAdmin,
        joinedAt: new Date().toISOString(),
    });
};

export const subscribeToRoom = (
    roomId: string,
    callback: (data: any) => void
): (() => void) => {
    const roomRef = ref(rtdb, `rooms/${roomId}`);

    onValue(roomRef, (snapshot) => {
        const data = snapshot.val();
        callback(data);
    });

    // Return unsubscribe function
    return () => off(roomRef);
};

// Queue management
export const addSongToQueue = async (
    roomId: string,
    song: Song // song is the clean object: { id, title, thumbnail, addedBy }
): Promise<string> => {
    const roomRef = ref(rtdb, `rooms/${roomId}`);
    const queueRef = ref(rtdb, `rooms/${roomId}/queue`);
    const newSongRef = push(queueRef);
    const addedAt = new Date().toISOString();
    const songForQueue = {
        ...song,
        firebaseKey: newSongRef.key,
        addedAt,
    };

    const result = await runTransaction(roomRef, (room) => {
        if (!room) return;
        const queue = room.queue ?? {};
        if (!room.currentSong && Object.keys(queue).length === 0) {
            room.currentSong = songForQueue;
            room.isPlaying = true;
        } else {
            room.queue = { ...queue, [newSongRef.key!]: songForQueue };
        }
        return room;
    });
    if (!result.committed) throw new Error("Room was unavailable while adding song");

    return newSongRef.key as string;
};

export const advanceRoomQueue = async (
    roomId: string,
    expectedCurrentSong?: Song
): Promise<boolean> => {
    const roomRef = ref(rtdb, `rooms/${roomId}`);
    const result = await runTransaction(roomRef, (room) => {
        if (!room) return;
        const active = room.currentSong as Song | null;
        if (expectedCurrentSong && (
            !active ||
            active.id !== expectedCurrentSong.id ||
            (expectedCurrentSong.firebaseKey && active.firebaseKey !== expectedCurrentSong.firebaseKey)
        )) return;

        const queue = room.queue ?? {};
        const entries = Object.entries(queue).sort(([, a], [, b]) => {
            const aTime = Date.parse((a as Song).addedAt ?? "");
            const bTime = Date.parse((b as Song).addedAt ?? "");
            return (Number.isFinite(aTime) ? aTime : 0) - (Number.isFinite(bTime) ? bTime : 0);
        });
        // Older versions also stored the active song in queue without
        // copying its Firebase key to currentSong. Drop that mirrored head.
        if (active && !active.firebaseKey && (entries[0]?.[1] as Song | undefined)?.id === active.id) {
            delete queue[entries[0][0]];
            entries.shift();
        }
        const next = entries[0];
        if (next) {
            const [key, queuedSong] = next;
            delete queue[key];
            room.queue = queue;
            room.currentSong = { ...(queuedSong as Song), firebaseKey: (queuedSong as Song).firebaseKey ?? key };
            room.isPlaying = true;
        } else {
            room.currentSong = null;
            room.isPlaying = false;
        }
        return room;
    });
    return result.committed;
};

export const removeSongFromQueue = async (
    roomId: string,
    songId: string
): Promise<void> => {
    const songRef = ref(rtdb, `rooms/${roomId}/queue/${songId}`);
    await remove(songRef);
};

export const subscribeToQueue = (
    roomId: string,
    callback: (songs: Song[]) => void
): (() => void) => {
    const queueRef = ref(rtdb, `rooms/${roomId}/queue`);

    onValue(queueRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            const songs = Object.entries(data).map(([firebaseKey, song]) => ({
                firebaseKey, // Include the Firebase key for removal operations
                ...(song as any),
            }));
            callback(songs);
        } else {
            callback([]);
        }
    });

    // Return unsubscribe function
    return () => off(queueRef);
};

// User management
export const addUserToRoom = async (
    roomId: string,
    user: User
): Promise<string> => {
    const usersRef = ref(rtdb, `rooms/${roomId}/users`);
    const newUserRef = push(usersRef);

    await set(newUserRef, {
        ...user,
        joinedAt: new Date().toISOString(),
    });

    return newUserRef.key as string;
};

export const removeUserFromRoom = async (
    roomId: string,
    userId: string
): Promise<void> => {
    const userRef = ref(rtdb, `rooms/${roomId}/users/${userId}`);
    await remove(userRef);
};

export const subscribeToUsers = (
    roomId: string,
    callback: (users: User[]) => void
): (() => void) => {
    const usersRef = ref(rtdb, `rooms/${roomId}/users`);

    onValue(usersRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            const users = Object.entries(data).map(([id, user]) => ({
                id,
                ...(user as any),
            }));
            callback(users);
        } else {
            callback([]);
        }
    });

    // Return unsubscribe function
    return () => off(usersRef);
};

// Add the new function here
export const findUserByNameInRoom = async (
    roomId: string,
    userName: string
): Promise<User | null> => {
    const usersRef = ref(rtdb, `rooms/${roomId}/users`);
    const snapshot = await get(usersRef);
    if (snapshot.exists()) {
        const usersData = snapshot.val();
        for (const userIdKey in usersData) {
            // Check if the user object exists and has a name property
            if (
                usersData.hasOwnProperty(userIdKey) &&
                usersData[userIdKey] &&
                usersData[userIdKey].name === userName
            ) {
                return {
                    id: userIdKey, // This is the Firebase key
                    name: usersData[userIdKey].name,
                    isAdmin: usersData[userIdKey].isAdmin,
                    // Include other relevant fields if necessary, e.g., joinedAt
                } as User;
            }
        }
    }
    return null;
};

// Current song management
export const updateCurrentSong = async (
    roomId: string,
    song: Song | null
): Promise<void> => {
    const songRef = ref(rtdb, `rooms/${roomId}/currentSong`);
    await set(songRef, song);
};

export const subscribeToCurrentSong = (
    roomId: string,
    callback: (song: Song | null) => void
): (() => void) => {
    const songRef = ref(rtdb, `rooms/${roomId}/currentSong`);

    onValue(songRef, (snapshot) => {
        const data = snapshot.val();
        callback(data);
    });

    // Return unsubscribe function
    return () => off(songRef);
};

// Player state management
export const updatePlayerState = async (
    roomId: string,
    isPlaying: boolean,
    isMuted: boolean
): Promise<void> => {
    const roomRef = ref(rtdb, `rooms/${roomId}`);
    await update(roomRef, {
        isPlaying,
        isMuted,
    });
};

export const subscribeToPlayerState = (
    roomId: string,
    callback: (isPlaying: boolean, isMuted: boolean) => void
): (() => void) => {
    const roomRef = ref(rtdb, `rooms/${roomId}`);

    onValue(roomRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            callback(data.isPlaying || false, data.isMuted || false);
        }
    });

    // Return unsubscribe function
    return () => off(roomRef);
};

// Score management functions
export const saveScore = async (
    roomId: string,
    userId: string,
    userName: string,
    songTitle: string,
    score: number
): Promise<string> => {
    const scoresRef = ref(rtdb, `rooms/${roomId}/scores`);
    const newScoreRef = push(scoresRef);

    const scoreData = {
        userId,
        userName,
        songTitle,
        score,
        timestamp: new Date().toISOString(),
    };

    await set(newScoreRef, scoreData);
    return newScoreRef.key as string;
};

export const getRoomHighScores = async (
    roomId: string,
    limit: number = 10
): Promise<Score[]> => {
    const scoresRef = ref(rtdb, `rooms/${roomId}/scores`);
    const snapshot = await get(scoresRef);

    if (!snapshot.exists()) {
        return [];
    }

    const scoresData = snapshot.val();
    const scores: Score[] = Object.entries(scoresData).map(([id, data]) => ({
        id,
        ...(data as any),
    }));

    // Sort by score (highest first)
    scores.sort((a, b) => b.score - a.score);

    // Return top scores based on limit
    return scores.slice(0, limit);
};

export const getUserHighScores = async (
    roomId: string,
    userId: string,
    limit: number = 5
): Promise<Score[]> => {
    const scoresRef = ref(rtdb, `rooms/${roomId}/scores`);
    const snapshot = await get(scoresRef);

    if (!snapshot.exists()) {
        return [];
    }

    const scoresData = snapshot.val();
    const scores: Score[] = Object.entries(scoresData)
        .map(([id, data]) => ({
            id,
            ...(data as any),
        }))
        .filter((score) => score.userId === userId);

    // Sort by score (highest first)
    scores.sort((a, b) => b.score - a.score);

    // Return top scores based on limit
    return scores.slice(0, limit);
};

export const subscribeToRoomHighScores = (
    roomId: string,
    callback: (scores: Score[]) => void,
    limit: number = 10
): (() => void) => {
    const scoresRef = ref(rtdb, `rooms/${roomId}/scores`);

    const onScoresUpdate = (snapshot: any) => {
        if (!snapshot.exists()) {
            callback([]);
            return;
        }

        const scoresData = snapshot.val();
        const scores: Score[] = Object.entries(scoresData).map(
            ([id, data]) => ({
                id,
                ...(data as any),
            })
        );

        // Sort by score (highest first)
        scores.sort((a, b) => b.score - a.score);

        // Return top scores based on limit
        callback(scores.slice(0, limit));
    };

    onValue(scoresRef, onScoresUpdate);

    // Return unsubscribe function
    return () => off(scoresRef, "value", onScoresUpdate);
};

// For manual testing of room cleanup
export const testCleanupOldRooms = async (
    daysOld: number = 1
): Promise<number> => {
    const roomsRef = ref(rtdb, "rooms");
    const snapshot = await get(roomsRef);

    if (!snapshot.exists()) {
        return 0;
    }

    const rooms = snapshot.val();
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - daysOld * 24 * 60 * 60 * 1000);
    let deletedCount = 0;

    for (const roomId in rooms) {
        if (rooms.hasOwnProperty(roomId)) {
            const room = rooms[roomId];

            if (!room.createdAt) {
                continue;
            }

            // Parse the ISO string to a Date object for proper comparison
            const roomCreatedAt = new Date(room.createdAt);
            const isOld = roomCreatedAt < cutoffDate;
        }
    }

    return Object.keys(rooms).length;
};

// For manual deletion after testing
export const confirmCleanupOldRooms = async (
    daysOld: number = 1
): Promise<number> => {
    const roomsRef = ref(rtdb, "rooms");
    const snapshot = await get(roomsRef);

    if (!snapshot.exists()) {
        return 0;
    }

    const rooms = snapshot.val();
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - daysOld * 24 * 60 * 60 * 1000);
    let deletedCount = 0;

    for (const roomId in rooms) {
        if (rooms.hasOwnProperty(roomId)) {
            const room = rooms[roomId];

            if (!room.createdAt) {
                continue;
            }

            // Parse the ISO string to a Date object for proper comparison
            const roomCreatedAt = new Date(room.createdAt);
            const isOld = roomCreatedAt < cutoffDate;

            // Check if room is older than specified days
            if (isOld) {
                // Room is older than specified days, delete it
                const roomRef = ref(rtdb, `rooms/${roomId}`);
                await remove(roomRef);
                deletedCount++;
            }
        }
    }

    return deletedCount;
};
