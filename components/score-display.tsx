"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trophy, Music, Star } from "lucide-react";
import { saveScore } from "@/lib/firebase-service";
import {
    animateScoreReveal,
    getPerformanceRating,
    generatePerformanceScore,
} from "@/lib/scoring-service";
import type { User, Song } from "@/types/room";

interface ScoreDisplayModalProps {
    open: boolean;
    onClose: () => void;
    roomId: string;
    currentUser: User | null;
    currentSong: Song | null;
    handleSongEnded?: () => void; // Added optional prop for handleSongEnded
}

export const ScoreDisplayModal: React.FC<ScoreDisplayModalProps> = ({
    open,
    onClose,
    roomId,
    currentUser,
    currentSong,
    handleSongEnded,
}) => {
    const [score, setScore] = useState<number>(0);
    const [isAnimating, setIsAnimating] = useState<boolean>(false);
    const [isCompleted, setIsCompleted] = useState<boolean>(false);
    const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(
        null
    );

    // Initialize audio element
    useEffect(() => {
        // Using the full path from the public folder
        const audio = new Audio("/sounds/karaoke.mp3");
        audio.preload = "auto"; // Preload the audio

        // Add event listeners for debugging
        audio.addEventListener("error", (e) => {
            console.error("Audio error:", e);
            console.error(
                "Audio error code:",
                audio.error ? audio.error.code : "unknown"
            );
        });

        audio.addEventListener("canplaythrough", () => {
            console.log("Audio can play through");
        });

        setAudioElement(audio);

        return () => {
            if (audio) {
                audio.pause();
                audio.currentTime = 0;
                // Clean up event listeners
                audio.removeEventListener("error", () => {});
                audio.removeEventListener("canplaythrough", () => {});
            }
        };
    }, []);

    // Start animation when dialog opens
    useEffect(() => {
        if (open && !isAnimating && !isCompleted) {
            startScoreAnimation();
        }
    }, [open]);

    const startScoreAnimation = () => {
        setIsAnimating(true);
        setIsCompleted(false);

        // Generate a score between 80-100
        const finalScore = generatePerformanceScore();

        // Play sound effect
        if (audioElement) {
            audioElement.currentTime = 0;
            console.log("Attempting to play audio from:", audioElement.src);

            // Try to play the audio
            audioElement
                .play()
                .then(() => console.log("Audio playing successfully"))
                .catch((err) => {
                    console.error("Failed to play audio:", err);
                    // Create a new audio element and try again with the full URL
                    const fallbackAudio = new Audio(
                        window.location.origin + "/sounds/karaoke.mp3"
                    );
                    fallbackAudio
                        .play()
                        .then(() =>
                            console.log("Fallback audio playing successfully")
                        )
                        .catch((fallbackErr) =>
                            console.error(
                                "Fallback audio also failed:",
                                fallbackErr
                            )
                        );
                });
        }

        // Animate the score
        animateScoreReveal(
            finalScore,
            3000, // 3 seconds animation
            {
                onStart: () => {
                    setIsAnimating(true);
                },
                onUpdate: (currentValue) => {
                    setScore(currentValue);
                },
                onComplete: async (finalScore) => {
                    setScore(finalScore);
                    setIsAnimating(false);
                    setIsCompleted(true);

                    // Save the score to Firebase if we have all the data
                    if (roomId && currentUser && currentSong) {
                        try {
                            await saveScore(
                                roomId,
                                currentUser.id,
                                currentUser.name,
                                currentSong.title,
                                finalScore
                            );
                        } catch (error) {
                            console.error("Failed to save score:", error);
                        }
                    }
                },
            }
        );
    };

    const handleClose = () => {
        if (audioElement) {
            audioElement.pause();
            audioElement.currentTime = 0;
        }
        setIsAnimating(false);
        setIsCompleted(false);
        onClose(); // Call the parent's onClose function

        // Call handleSongEnded if it exists
        if (handleSongEnded) {
            console.log("Calling handleSongEnded from score modal");
            handleSongEnded();
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="bg-gray-900 border-purple-500 text-white max-w-md mx-auto">
                <DialogHeader>
                    <DialogTitle className="text-2xl text-center text-purple-500 flex items-center justify-center gap-2">
                        <Trophy className="h-6 w-6 text-yellow-400" />
                        Performance Score
                    </DialogTitle>
                </DialogHeader>

                <div className="py-8 flex flex-col items-center justify-center">
                    {/* Current song display */}
                    {currentSong && (
                        <div className="mb-4 flex items-center gap-2 text-gray-300">
                            <Music className="h-4 w-4" />
                            <span className="text-sm font-medium">
                                {currentSong.title}
                            </span>
                        </div>
                    )}

                    {/* Score animation */}
                    <div className="relative">
                        <motion.div
                            className="text-7xl font-bold text-white"
                            key={score}
                            initial={{ scale: 0.8, opacity: 0.5 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.1 }}
                        >
                            {score}
                        </motion.div>

                        {/* Stars animation when score is complete */}
                        <AnimatePresence>
                            {isCompleted && (
                                <>
                                    {[...Array(5)].map((_, i) => (
                                        <motion.div
                                            key={`star-${i}`}
                                            className="absolute top-1/2 left-1/2"
                                            initial={{
                                                x: 0,
                                                y: 0,
                                                scale: 0,
                                                opacity: 0,
                                            }}
                                            animate={{
                                                x: Math.random() * 100 - 50,
                                                y: Math.random() * 100 - 50,
                                                scale:
                                                    Math.random() * 0.5 + 0.5,
                                                opacity: 1,
                                            }}
                                            exit={{ opacity: 0 }}
                                            transition={{
                                                duration: 0.5,
                                                delay: i * 0.1,
                                            }}
                                        >
                                            <Star className="text-yellow-400 h-4 w-4" />
                                        </motion.div>
                                    ))}
                                </>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Performance rating */}
                    <AnimatePresence>
                        {isCompleted && (
                            <motion.div
                                className="mt-4 text-xl font-bold text-purple-400"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                            >
                                {getPerformanceRating(score)}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <div className="flex justify-center">
                    <Button
                        onClick={handleClose}
                        className="bg-purple-600 hover:bg-purple-500"
                    >
                        Close
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
