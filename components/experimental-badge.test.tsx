import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ExperimentalBadge } from "./experimental-badge";

describe("ExperimentalBadge", () => {
    it("renders an Experimental label when enabled", () => {
        expect(
            renderToStaticMarkup(
                createElement(ExperimentalBadge, { experimental: true })
            )
        ).toContain("Experimental");
    });

    it("renders nothing when the feature is not experimental", () => {
        expect(
            renderToStaticMarkup(
                createElement(ExperimentalBadge, { experimental: false })
            )
        ).toBe("");
    });
});
