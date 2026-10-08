export function roomLastActivity(room: unknown): number | null {
    if (!room || typeof room !== "object") return null;
    const value = room as Record<string, unknown>;
    const users = value.users && typeof value.users === "object"
        ? (value.users as Record<string, unknown>)
        : {};
    const seen = Object.values(users)
        .map((user) => user && typeof user === "object" ? Date.parse(String((user as Record<string, unknown>).lastSeen ?? "")) : NaN)
        .filter(Number.isFinite);
    if (seen.length) return Math.max(...seen);
    const created = Date.parse(String(value.createdAt ?? ""));
    return Number.isFinite(created) ? created : null;
}

export function roomIsIdle(room: unknown, cutoffMs: number): boolean {
    const activity = roomLastActivity(room);
    return activity !== null && activity < cutoffMs;
}

export function normalizeRoom(roomId: string, room: unknown) {
    const value = room && typeof room === "object" ? room as Record<string, unknown> : {};
    return {
        id: roomId,
        createdAt: typeof value.createdAt === "string" ? value.createdAt : null,
        lastActivity: roomLastActivity(room),
        currentSong: value.currentSong ?? null,
        users: value.users && typeof value.users === "object" ? value.users : {},
        queue: value.queue && typeof value.queue === "object" ? value.queue : {},
        scores: value.scores && typeof value.scores === "object" ? value.scores : {},
        micFeatureEnabled: Boolean(value.micFeatureEnabled),
        scorerEnabled: Boolean(value.scorerEnabled),
        reactionsEnabled: Boolean(value.reactionsEnabled),
    };
}
