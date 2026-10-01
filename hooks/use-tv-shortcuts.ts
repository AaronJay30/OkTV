"use client";

import { useEffect } from "react";

/**
 * Maps TV remote buttons to in-app behavior.
 *
 * - **Back** on the remote triggers `popstate`. We listen for it and call
 *   `onBack()` (typically: close the topmost open dialog). The router's own
 *   back behavior is preserved — if no dialog consumes the event, the browser
 *   navigates as usual.
 * - **Escape** on a desktop keyboard does the same thing for symmetry.
 *
 * `useTvBack` is a thin wrapper that registers the listener once. Push a
 * history entry when opening a dialog so Back closes it instead of leaving
 * the room.
 *
 * @example
 *   useTvBack({
 *       isOpen: directLinkOpen,
 *       onClose: () => setDirectLinkOpen(false),
 *   });
 */
export interface UseTvBackOptions {
    /** True when a dialog/overlay is currently open and Back should close it. */
    isOpen: boolean;
    onClose: () => void;
}

export function useTvBack({ isOpen, onClose }: UseTvBackOptions) {
    useEffect(() => {
        if (!isOpen) return;

        // Push a sentinel history entry so Back pops to it and triggers
        // popstate, instead of leaving the room.
        window.history.pushState({ dialog: true }, "");

        const onPop = () => {
            onClose();
            // After consuming the Back, replace our sentinel with the prior
            // entry so the next Back goes where the user expects (out of
            // the room).
            window.history.replaceState(
                { dialog: false },
                "",
                window.location.href
            );
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };

        window.addEventListener("popstate", onPop);
        window.addEventListener("keydown", onKey);

        return () => {
            window.removeEventListener("popstate", onPop);
            window.removeEventListener("keydown", onKey);
        };
    }, [isOpen, onClose]);
}
