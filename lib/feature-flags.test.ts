import { describe, expect, it } from "vitest";
import { normalizeFlags, shouldSkipCreateRoomModal } from "./feature-flags";

describe("feature flags", () => {
    it("defaults missing global flags to enabled", () => {
        expect(normalizeFlags(null)).toEqual({
            phoneMicEnabled: true,
            scorerEnabled: true,
            reactionsEnabled: true,
        });
    });

    it("skips the creation modal only when every configurable feature is off", () => {
        expect(
            shouldSkipCreateRoomModal({
                phoneMicEnabled: false,
                scorerEnabled: false,
                reactionsEnabled: false,
            })
        ).toBe(true);
        expect(
            shouldSkipCreateRoomModal({
                phoneMicEnabled: false,
                scorerEnabled: false,
                reactionsEnabled: true,
            })
        ).toBe(false);
    });
});
