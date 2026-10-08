import { REACTION_VISIBLE_MS } from "./realtime-reactions";
import type { Reaction } from "../types/room";

export function getReactionPosition(reaction: Reaction, index: number) {
    const seed = [...(reaction.id ?? `${reaction.createdAt}-${index}`)].reduce(
        (total, character) => total + character.charCodeAt(0),
        0
    );

    return {
        left: `${10 + ((seed * 17) % 81)}%`,
        offset: -12 + ((seed * 7) % 25),
    };
}

export function getVisibleReactions(
    reactions: Reaction[],
    now: number = Date.now()
): Reaction[] {
    return reactions.filter(
        (reaction) => now - reaction.createdAt < REACTION_VISIBLE_MS
    );
}
