"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    REACTION_OPTIONS,
    sendReaction,
} from "@/lib/realtime-reactions";

interface ReactionPickerProps {
    roomId: string;
    userName: string;
    disabled?: boolean;
}

export function ReactionPicker({
    roomId,
    userName,
    disabled = false,
}: ReactionPickerProps) {
    const [error, setError] = useState(false);

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
        <div className="fixed bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-full border border-purple-400/40 bg-gray-950/90 p-2 shadow-xl backdrop-blur">
            <span className="sr-only">Send a reaction</span>
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
                    className="h-10 w-10 text-xl hover:bg-purple-500/30"
                >
                    {option.emoji}
                </Button>
            ))}
            <Send className="ml-1 h-3.5 w-3.5 text-purple-300" aria-hidden="true" />
            {error && <span className="sr-only">Reaction failed to send</span>}
        </div>
    );
}
