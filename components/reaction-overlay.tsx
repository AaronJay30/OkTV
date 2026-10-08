"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    REACTION_VISIBLE_MS,
    subscribeToReactions,
} from "@/lib/realtime-reactions";
import {
    getReactionPosition,
    getVisibleReactions,
} from "@/lib/reaction-utils";
import type { Reaction } from "@/types/room";

interface ReactionOverlayProps {
    roomId: string;
    isAdmin?: boolean;
}

export function ReactionOverlay({ roomId, isAdmin = false }: ReactionOverlayProps) {
    const [reactions, setReactions] = useState<Reaction[]>([]);

    useEffect(() => {
        return subscribeToReactions(roomId, (nextReactions) => {
            setReactions(getVisibleReactions(nextReactions));
        });
    }, [roomId]);

    useEffect(() => {
        if (!reactions.length) return;
        const timer = window.setTimeout(() => {
            setReactions((current) => getVisibleReactions(current));
        }, REACTION_VISIBLE_MS);
        return () => window.clearTimeout(timer);
    }, [reactions]);

    return (
        <div className="reaction-overlay" aria-live="polite" aria-atomic="false">
            <AnimatePresence>
                {reactions.map((reaction, index) => {
                        const position = getReactionPosition(reaction, index);

                        return (
                            <motion.div
                                key={reaction.id ?? `${reaction.createdAt}-${index}`}
                                initial={{ opacity: 0, y: 48, scale: 0.7 }}
                                animate={{
                                    opacity: [0, 1, 1, 0, 0],
                                    y: [48, -80, -260, -520, -820],
                                    x: [
                                        position.offset * 0.5,
                                        position.offset,
                                        position.offset * 0.7,
                                        position.offset,
                                        position.offset * 1.1,
                                    ],
                                    scale: [0.7, 1, 1, 0.9, 0.8],
                                }}
                                exit={{ opacity: 0, y: -900, scale: 0.8 }}
                                transition={{
                                    duration: 6.5,
                                    ease: "linear",
                                    times: [0, 0.1, 0.4, 0.7, 1],
                                }}
                                className="absolute flex will-change-transform flex-col items-center text-3xl drop-shadow-lg"
                                style={{ left: position.left, bottom: "3%" }}
                            >
                                <span aria-hidden="true">{reaction.emoji}</span>
                                {!isAdmin && (
                                    <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">
                                        {reaction.userName}
                                    </span>
                                )}
                            </motion.div>
                        );
                })}
            </AnimatePresence>
        </div>
    );
}
