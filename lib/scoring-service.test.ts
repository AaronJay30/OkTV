import { describe, expect, it } from "vitest";
import { generatePerformanceScore, getPerformanceRating } from "./scoring-service";

describe("generatePerformanceScore", () => {
    it.each([
        [0, 70],
        [0.1, 80],
        [0.6, 90],
        [0.9, 97],
        [0.999999, 100],
    ])("maps random value %s to score %s", (random, expected) => {
        expect(generatePerformanceScore(() => random)).toBe(expected);
    });

    it("always returns an integer from 70 through 100", () => {
        for (let index = 0; index < 1000; index += 1) {
            const score = generatePerformanceScore(() => index / 1000);
            expect(Number.isInteger(score)).toBe(true);
            expect(score).toBeGreaterThanOrEqual(70);
            expect(score).toBeLessThanOrEqual(100);
        }
    });
});

describe("getPerformanceRating", () => {
    it("keeps the rating bands aligned with the score range", () => {
        expect(getPerformanceRating(70)).toBe("Nice Performance!");
        expect(getPerformanceRating(90)).toBe("Amazing Performance!");
        expect(getPerformanceRating(95)).toBe("Outstanding!");
    });
});
