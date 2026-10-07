import { REACTION_VISIBLE_MS } from "./realtime-reactions";
import type { Reaction } from "../types/room";

export function getVisibleReactions(
    reactions: Reaction[],
    now: number = Date.now()
): Reaction[] {
    return reactions.filter(
        (reaction) => now - reaction.createdAt < REACTION_VISIBLE_MS
    );
}
