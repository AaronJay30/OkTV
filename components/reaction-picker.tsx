"use client";

import { useState } from "react";
import { SmilePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExperimentalBadge } from "@/components/experimental-badge";
import { cn } from "@/lib/utils";
import {
    REACTION_OPTIONS,
    sendReaction,
} from "@/lib/realtime-reactions";

interface ReactionPickerProps {
    roomId: string;
    userName: string;
    disabled?: boolean;
    experimental?: boolean;
}

export function ReactionPicker({
    roomId,
    userName,
    disabled = false,
    experimental = false,
}: ReactionPickerProps) {
    const [error, setError] = useState(false);
    const [isOpen, setIsOpen] = useState(true);

    async function handleReaction(emoji: string) {
        if (disabled || !userName.trim()) return;
        setError(false);
        try {
            await sendReaction(roomId, { emoji, userName });
        } catch {
            setError(true);
        }
    }

    return (
        <>
            {!isOpen && (
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Show reactions"
                    title="Show reactions"
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-4 left-1/2 z-30 h-11 w-11 -translate-x-1/2 rounded-full border border-purple-400/40 bg-gray-950/90 text-purple-200 shadow-xl backdrop-blur md:hidden"
                >
                    <SmilePlus className="h-5 w-5" aria-hidden="true" />
                </Button>
            )}
            <div
                role="group"
                aria-label="Live reactions"
                className={cn(
                    "fixed bottom-4 left-1/2 z-30 flex max-w-[calc(100vw-1rem)] -translate-x-1/2 items-center gap-1 rounded-full border border-purple-400/40 bg-gray-950/90 p-2 shadow-xl backdrop-blur",
                    !isOpen && "hidden md:flex"
                )}
            >
                {REACTION_OPTIONS.map((option) => (
                    <Button
                        key={option.emoji}
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Send ${option.label} reaction`}
                        title={option.label}
                        disabled={disabled || !userName.trim()}
                        onClick={() => void handleReaction(option.emoji)}
                        className="h-9 w-9 text-xl hover:bg-purple-500/30 sm:h-10 sm:w-10"
                    >
                        {option.emoji}
                    </Button>
                ))}
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Hide reactions"
                    title="Hide reactions"
                    onClick={() => setIsOpen(false)}
                    className="h-9 w-9 text-purple-200 hover:bg-purple-500/30 md:hidden"
                >
                    <X className="h-4 w-4" aria-hidden="true" />
                </Button>
                <ExperimentalBadge experimental={experimental} />
                {error && <span className="sr-only">Reaction failed to send</span>}
            </div>
        </>
    );
}
