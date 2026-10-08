import { describe, expect, it } from "vitest";
import { normalizeFlags, shouldSkipCreateRoomModal } from "./feature-flags";

describe("feature flags", () => {
    it("defaults missing global flags to enabled", () => {
        expect(normalizeFlags(null)).toEqual({
            phoneMicEnabled: true,
            scorerEnabled: true,
            reactionsEnabled: true,
            phoneMicExperimental: false,
            scorerExperimental: false,
            reactionsExperimental: false,
        });
    });

    it("preserves valid experimental values and defaults invalid ones to false", () => {
        expect(
            normalizeFlags({
                phoneMicEnabled: false,
                scorerEnabled: true,
                reactionsEnabled: false,
                phoneMicExperimental: true,
                scorerExperimental: "true",
            })
        ).toEqual({
            phoneMicEnabled: false,
            scorerEnabled: true,
            reactionsEnabled: false,
            phoneMicExperimental: true,
            scorerExperimental: false,
            reactionsExperimental: false,
        });
    });

    it("skips the creation modal only when every configurable feature is off", () => {
        expect(
            shouldSkipCreateRoomModal({
                phoneMicEnabled: false,
                scorerEnabled: false,
                reactionsEnabled: false,
                phoneMicExperimental: false,
                scorerExperimental: false,
                reactionsExperimental: false,
            })
        ).toBe(true);
        expect(
            shouldSkipCreateRoomModal({
                phoneMicEnabled: false,
                scorerEnabled: false,
                reactionsEnabled: true,
                phoneMicExperimental: false,
                scorerExperimental: false,
                reactionsExperimental: false,
            })
        ).toBe(false);
    });
});
