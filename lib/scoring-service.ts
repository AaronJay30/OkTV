// lib/scoring-service.ts

/**
 * Generates a random performance score between 80 and 100.
 * @returns A random integer score.
 */
export const generatePerformanceScore = (): number => {
    return Math.floor(Math.random() * 21) + 80; // Random score between 80 and 100
};

/**
 * Types of animation callbacks for the score reveal
 */
export type ScoreAnimationCallbacks = {
    onStart?: () => void;
    onUpdate?: (currentValue: number) => void;
    onComplete?: (finalScore: number) => void;
};

/**
 * Handles the animation logic for revealing the score.
 * @param finalScore - The predetermined final score to display
 * @param duration - Animation duration in ms (default 3000ms)
 * @param callbacks - Callbacks for animation events
 */
export const animateScoreReveal = (
    finalScore: number,
    duration: number = 3000,
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
