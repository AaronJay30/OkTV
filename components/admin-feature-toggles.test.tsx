import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { AdminFeatureToggles } from "./admin-feature-toggles";

describe("AdminFeatureToggles", () => {
    it("renders separate accessible enabled and experimental switches", () => {
        const markup = renderToStaticMarkup(
            createElement(AdminFeatureToggles, {
                name: "Karaoke Scorer",
                enabled: true,
                experimental: false,
                onEnabledChange: vi.fn(),
                onExperimentalChange: vi.fn(),
            })
        );

        expect(markup.match(/role="switch"/g)).toHaveLength(2);
        expect(markup).toContain('aria-label="Enable Karaoke Scorer"');
        expect(markup).toContain('aria-label="Mark Karaoke Scorer experimental"');
        expect(markup).toContain('aria-checked="true"');
        expect(markup).toContain('aria-checked="false"');
        expect(markup).toContain(">Enabled</span>");
        expect(markup).toContain(">Experimental</span>");
    });

    it("disables both switches while a feature state is saving", () => {
        const markup = renderToStaticMarkup(
            createElement(AdminFeatureToggles, {
                name: "Live Reactions",
                enabled: true,
                experimental: true,
                disabled: true,
                onEnabledChange: vi.fn(),
                onExperimentalChange: vi.fn(),
            })
        );

        const switches = Array.from(
            markup.matchAll(/<button\b[^>]*role="switch"[^>]*>/g),
            ([button]) => button
        );
        expect(switches).toHaveLength(2);
        expect(switches.every((button) => button.includes("disabled=\"\""))).toBe(true);
    });
});
