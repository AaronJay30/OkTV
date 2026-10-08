import { describe, expect, it, vi } from "vitest";

vi.mock("./firebase", () => ({ rtdb: {} }));
import {
    isValidReaction,
    normalizeReactions,
    REACTION_OPTIONS,
} from "./realtime-reactions";

describe("realtime reactions", () => {
    it("provides labeled reaction options", () => {
        expect(REACTION_OPTIONS.length).toBeGreaterThanOrEqual(4);
        expect(REACTION_OPTIONS.every((option) => option.label.length > 0)).toBe(
            true
        );
    });

    it("validates supported emoji and bounded usernames", () => {
        expect(isValidReaction({ emoji: "👏", userName: " Alex " })).toBe(true);
        expect(isValidReaction({ emoji: "👏", userName: "   " })).toBe(false);
        expect(isValidReaction({ emoji: "👏", userName: "a".repeat(41) })).toBe(
            false
        );
        expect(isValidReaction({ emoji: "🚫", userName: "Alex" })).toBe(false);
    });

    it("keeps repeated valid events and ignores malformed snapshot entries", () => {
        const result = normalizeReactions({
            first: { emoji: "👏", userName: "Alex", createdAt: 100 },
            second: { emoji: "👏", userName: "Alex", createdAt: 101 },
            malformed: { emoji: "🚫", userName: "Alex", createdAt: 102 },
        });

        expect(result).toHaveLength(2);
        expect(result.map((reaction) => reaction.id)).toEqual([
            "second",
            "first",
        ]);
    });
});
