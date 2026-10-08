import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/realtime-reactions", () => ({
    REACTION_OPTIONS: [
        { emoji: "👏", label: "Clap" },
        { emoji: "🔥", label: "Fire" },
    ],
    sendReaction: vi.fn(),
}));

import { ReactionPicker } from "./reaction-picker";

describe("ReactionPicker", () => {
    it("renders reactions with a mobile hide control", () => {
        const markup = renderToStaticMarkup(
            createElement(ReactionPicker, {
                roomId: "room",
                userName: "Singer",
            })
        );

        expect(markup).toContain('aria-label="Hide reactions"');
        expect(markup).toContain("👏");
        expect(markup).not.toContain("lucide-send");
    });
});
