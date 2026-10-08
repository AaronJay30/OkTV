// lib/scoring-service.ts

/**
 * Generates a weighted performance score so ordinary performances are common
 * while exceptional scores remain possible.
 */
export const generatePerformanceScore = (random: () => number = Math.random): number => {
    const value = Math.min(0.999999, Math.max(0, random()));

    if (value < 0.1) return 70 + Math.floor(value * 100);
    if (value < 0.6) return 80 + Math.floor((value - 0.1) * 20);
    if (value < 0.9) return 90 + Math.floor((value - 0.6) * (7 / 0.3));
    return 97 + Math.floor((value - 0.9) * 40);
};

/**
 * Types of animation callbacks for the score reveal
 */
export type ScoreAnimationCallbacks = {
    onStart?: () => void;
    onUpdate?: (currentValue: number) => void;
    onComplete?: (finalScore: number) => void;
};

export const SCORE_REVEAL_DURATION_MS = 4000;
export const SCORE_MODAL_DURATION_MS = 16000;

/**
 * Handles the animation logic for revealing the score.
 * @param finalScore - The predetermined final score to display
 * @param duration - Animation duration in ms (default 4000ms)
 * @param callbacks - Callbacks for animation events
 */
export const animateScoreReveal = (
    finalScore: number,
    duration: number = SCORE_REVEAL_DURATION_MS,
    callbacks?: ScoreAnimationCallbacks
): void => {
    // Start time for the animation
    const startTime = Date.now();
    const endTime = startTime + duration;

    // Call the onStart callback if provided
    if (callbacks?.onStart) {
        callbacks.onStart();
    }

    // Animation interval
    const interval = 50; // 50ms between updates

    // Function to run on each animation frame
    const animate = () => {
        const now = Date.now();
        const progress = Math.min(1, (now - startTime) / duration);

        if (progress < 1) {
            // During animation, show random values between 50-100
            const currentValue = Math.floor(Math.random() * 51) + 50;

            // Call the onUpdate callback with the current value
            if (callbacks?.onUpdate) {
                callbacks.onUpdate(currentValue);
            }

            // Continue animation
            requestAnimationFrame(animate);
        } else {
            // Animation complete, show final score
            if (callbacks?.onUpdate) {
                callbacks.onUpdate(finalScore);
            }

            // Call the onComplete callback
            if (callbacks?.onComplete) {
                callbacks.onComplete(finalScore);
            }
        }
    };

    // Start the animation
    requestAnimationFrame(animate);
};

/**
 * Get a performance rating text based on the score
 */
export const getPerformanceRating = (score: number): string => {
    if (score >= 95) return "Outstanding!";
    if (score >= 90) return "Amazing Performance!";
    if (score >= 85) return "Great Job!";
    return "Nice Performance!";
};
