"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    REACTION_VISIBLE_MS,
    subscribeToReactions,
} from "@/lib/realtime-reactions";
import { getVisibleReactions } from "@/lib/reaction-utils";
import type { Reaction } from "@/types/room";

function positionFor(reaction: Reaction, index: number) {
    const seed = [...(reaction.id ?? `${reaction.createdAt}-${index}`)].reduce(
        (total, character) => total + character.charCodeAt(0),
        0
    );
    return {
        left: `${12 + ((seed * 17) % 76)}%`,
        bottom: `${18 + ((seed * 7) % 20)}%`,
    };
}

interface ReactionOverlayProps {
    roomId: string;
}

export function ReactionOverlay({ roomId }: ReactionOverlayProps) {
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
                {reactions.map((reaction, index) => (
                    <motion.div
                        key={reaction.id ?? `${reaction.createdAt}-${index}`}
                        initial={{ opacity: 0, y: 20, scale: 0.7 }}
                        animate={{ opacity: 1, y: -220, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 2.8, ease: "easeOut" }}
                        className="absolute flex flex-col items-center text-3xl drop-shadow-lg"
                        style={positionFor(reaction, index)}
                    >
                        <span aria-hidden="true">{reaction.emoji}</span>
                        <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">
                            {reaction.userName}
                        </span>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}
