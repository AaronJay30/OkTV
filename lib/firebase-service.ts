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
} from "firebase/database";
import { rtdb } from "./firebase";
import type { Song, User } from "@/types/room";

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
    }return deletedCount;
};

// Room management
export const createRoom = async (
    roomId: string,
    adminUser: User
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
    const roomSnapshot = await get(roomRef);
    const roomData = roomSnapshot.val();

    // Determine if this is the first song scenario
    // It's the first song if there's no current song AND the queue is empty
    const isFirstSongScenario =
        !roomData?.currentSong &&
        (!roomData?.queue || Object.keys(roomData.queue).length === 0);

    // Add song to queue with Firebase key and timestamp
    const queueRef = ref(rtdb, `rooms/${roomId}/queue`);
    const newSongRef = push(queueRef);
    const songForQueue = {
        ...song,
        firebaseKey: newSongRef.key,
        addedAt: new Date().toISOString(),
    };
    await set(newSongRef, songForQueue);

    // If it's the first song scenario, update currentSong and set isPlaying to true
    if (isFirstSongScenario) {
        await update(roomRef, {
            currentSong: song, // Use the original clean 'song' object for currentSong
            isPlaying: true,
            // isMuted state is preserved, not changed here
        });
    }

    return newSongRef.key as string;
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

// For manual testing of room cleanup
export const testCleanupOldRooms = async (daysOld: number = 1): Promise<number> => {
    
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
export const confirmCleanupOldRooms = async (daysOld: number = 1): Promise<number> => {
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
