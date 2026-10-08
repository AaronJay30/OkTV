import {
    DataSnapshot,
    off,
    onValue,
    push,
    ref,
    remove,
    set,
} from "firebase/database";
import type { Reaction } from "../types/room";
import { rtdb } from "./firebase";

export const REACTION_OPTIONS = [
    { emoji: "👏", label: "Clap" },
    { emoji: "🔥", label: "Fire" },
    { emoji: "❤️", label: "Love it" },
    { emoji: "😂", label: "Funny" },
    { emoji: "🎤", label: "Mic drop" },
] as const;

export const REACTION_VISIBLE_MS = 6000;

export function isValidReaction(
    reaction: Pick<Reaction, "emoji" | "userName">
): boolean {
    return (
        REACTION_OPTIONS.some((option) => option.emoji === reaction.emoji) &&
        reaction.userName.trim().length > 0 &&
        reaction.userName.trim().length <= 40
    );
}

function asReaction(id: string, value: unknown): Reaction | null {
    if (!value || typeof value !== "object") return null;
    const candidate = value as Partial<Reaction>;
    if (
        typeof candidate.emoji !== "string" ||
        typeof candidate.userName !== "string" ||
        typeof candidate.createdAt !== "number" ||
        !isValidReaction(candidate as Pick<Reaction, "emoji" | "userName">)
    ) {
        return null;
    }

    return {
        id,
        emoji: candidate.emoji,
        userName: candidate.userName.trim(),
        createdAt: candidate.createdAt,
    };
}

export function normalizeReactions(value: unknown): Reaction[] {
    if (!value || typeof value !== "object") return [];

    return Object.entries(value as Record<string, unknown>)
        .map(([id, reaction]) => asReaction(id, reaction))
        .filter((reaction): reaction is Reaction => reaction !== null)
        .sort((a, b) => b.createdAt - a.createdAt);
}

export async function sendReaction(
    roomId: string,
    reaction: Omit<Reaction, "id" | "createdAt">
): Promise<string> {
    if (!isValidReaction(reaction)) {
        throw new Error("Invalid reaction");
    }

    const reactionRef = push(ref(rtdb, `rooms/${roomId}/reactions`));
    if (!reactionRef.key) throw new Error("Failed to create reaction");

    await set(reactionRef, {
        emoji: reaction.emoji,
        userName: reaction.userName.trim(),
        createdAt: Date.now(),
    });

    return reactionRef.key;
}

export function subscribeToReactions(
    roomId: string,
    callback: (reactions: Reaction[]) => void
): () => void {
    const reactionsRef = ref(rtdb, `rooms/${roomId}/reactions`);
    const cleanupTimers = new Map<string, ReturnType<typeof setTimeout>>();
    const onReactionsUpdate = (snapshot: DataSnapshot) => {
        const reactions = normalizeReactions(snapshot.val());
        const cutoff = Date.now() - REACTION_VISIBLE_MS;

        callback(reactions.filter((reaction) => reaction.createdAt >= cutoff));

        for (const reaction of reactions) {
            if (!reaction.id || cleanupTimers.has(reaction.id)) continue;
            cleanupTimers.set(
                reaction.id,
                setTimeout(() => {
                    cleanupTimers.delete(reaction.id!);
                    void remove(ref(rtdb, `rooms/${roomId}/reactions/${reaction.id}`));
                }, Math.max(0, reaction.createdAt + REACTION_VISIBLE_MS - Date.now()))
            );
        }
    };

    onValue(reactionsRef, onReactionsUpdate);

    return () => {
        off(reactionsRef, "value", onReactionsUpdate);
        for (const timer of cleanupTimers.values()) clearTimeout(timer);
        cleanupTimers.clear();
    };
}
