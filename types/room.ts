// types/room.ts
export interface Song {
    id: string;
    title: string;
    thumbnail: string;
    addedBy: string;
    addedAt?: string;
    firebaseKey?: string; // The Firebase database key for this song
}

export interface User {
    id: string;
    name: string;
    isAdmin: boolean;
    joinedAt?: string;
    isMicOn?: boolean;
    isMutedByAdmin?: boolean;
}

export interface Score {
    id?: string;
    userId: string;
    userName: string;
    songTitle: string;
    score: number;
    timestamp: string;
}

export interface Room {
    createdAt: string;
    currentSong: Song | null;
    isPlaying: boolean;
    isMuted: boolean;
    micFeatureEnabled?: boolean;
    scorerEnabled?: boolean;
    queue?: Record<string, Song>;
    users?: Record<string, User>;
}
