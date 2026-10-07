import { describe, expect, it, vi } from "vitest";

vi.mock("../lib/firebase", () => ({ rtdb: {} }));
import { getVisibleReactions } from "../lib/reaction-utils";

describe("getVisibleReactions", () => {
    it("keeps every recent reaction, including rapid bursts", () => {
        const reactions = [
            { id: "1", emoji: "👏", userName: "Alex", createdAt: 9_999 },
            { id: "2", emoji: "🔥", userName: "Alex", createdAt: 9_998 },
            { id: "3", emoji: "❤️", userName: "Alex", createdAt: 9_997 },
        ];

        expect(getVisibleReactions(reactions, 10_000)).toHaveLength(3);
    });

    it("removes reactions older than the visible lifetime", () => {
        const reactions = [
            { id: "old", emoji: "👏", userName: "Alex", createdAt: 1_000 },
            { id: "new", emoji: "🔥", userName: "Alex", createdAt: 9_000 },
        ];

        expect(getVisibleReactions(reactions, 10_000).map((item) => item.id)).toEqual([
            "new",
        ]);
    });
});
