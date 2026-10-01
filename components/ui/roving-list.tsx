"use client";

import {
    useRef,
    useState,
    useEffect,
    useCallback,
    type KeyboardEvent,
    type ReactNode,
} from "react";

/**
 * RovingList — keyboard / D-pad friendly list container.
 *
 * Implements the WAI-ARIA "Listbox with Roving Tabindex" pattern. One item
 * holds `tabIndex={0}` (the focused item) and the rest hold `tabIndex={-1}`.
 * Arrow Up/Down (and Arrow Left/Right) move focus through items. Enter/Space
 * activates the focused item via `onActivate(index)`.
 *
 * Children should render via the {@link renderItem} prop, which receives the
 * per-item props (tabIndex, ref, onKeyDown) and the item data.
 *
 * @example
 *   <RovingList
 *       items={searchResults}
 *       getKey={(r) => r.id.videoId}
 *       onActivate={(idx) => addToQueue(searchResults[idx])}
 *       renderItem={(item, props, isFocused) => (
 *           <div {...props} className={isFocused ? "ring" : ""}>
 *               {item.snippet.title}
 *           </div>
 *       )}
 *   />
 */
export interface RovingListRenderProps<T> {
    /** Apply these to the rendered item element: tabIndex + keydown handler. */
    itemProps: {
        tabIndex: number;
        ref: (el: HTMLElement | null) => void;
        onKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
    };
    /** True when this item is the current roving focus. */
    isFocused: boolean;
}

export interface RovingListProps<T> {
    items: T[];
    getKey: (item: T, index: number) => string;
    onActivate?: (item: T, index: number) => void;
    /** How many columns to traverse before wrapping to the next row. Default 1. */
    columns?: number;
    /** Initial focused index. Default 0. */
    initialFocusIndex?: number;
    renderItem: (
        item: T,
        index: number,
        props: RovingListRenderProps<T>
    ) => ReactNode;
    className?: string;
}

export function RovingList<T>({
    items,
    getKey,
    onActivate,
    columns = 1,
    initialFocusIndex = 0,
    renderItem,
    className,
}: RovingListProps<T>) {
    const [focusedIndex, setFocusedIndex] = useState(() =>
        clampIndex(initialFocusIndex, items.length)
    );
    const itemRefs = useRef<(HTMLElement | null)[]>([]);

    // Reset focus when the list shrinks below the current focused index.
    useEffect(() => {
        if (focusedIndex >= items.length) {
            setFocusedIndex(Math.max(0, items.length - 1));
        }
    }, [items.length, focusedIndex]);

    const moveFocus = useCallback(
        (delta: number) => {
            if (items.length === 0) return;
            setFocusedIndex((prev) => {
                let next = prev + delta;
                // Wrap around.
                if (next < 0) next = items.length - 1;
                if (next >= items.length) next = 0;
                return next;
            });
        },
        [items.length]
    );

    const handleItemKeyDown = useCallback(
        (e: KeyboardEvent<HTMLElement>, index: number) => {
            const cols = Math.max(1, columns);
            switch (e.key) {
                case "ArrowDown":
                    e.preventDefault();
                    moveFocus(cols);
                    break;
                case "ArrowUp":
                    e.preventDefault();
                    moveFocus(-cols);
                    break;
                case "ArrowRight":
                    e.preventDefault();
                    moveFocus(1);
                    break;
                case "ArrowLeft":
                    e.preventDefault();
                    moveFocus(-1);
                    break;
                case "Home":
                    e.preventDefault();
                    setFocusedIndex(0);
                    break;
                case "End":
                    e.preventDefault();
                    setFocusedIndex(items.length - 1);
                    break;
                case "Enter":
                case " ":
                    if (onActivate) {
                        e.preventDefault();
                        onActivate(items[index], index);
                    }
                    break;
            }
        },
        [moveFocus, columns, items, onActivate]
    );

    // After focus changes, move DOM focus to the new item.
    useEffect(() => {
        const el = itemRefs.current[focusedIndex];
        if (el && document.activeElement !== el) {
            // Don't steal focus from text inputs in the page.
            const active = document.activeElement;
            if (
                active &&
                (active.tagName === "INPUT" ||
                    active.tagName === "TEXTAREA" ||
                    (active as HTMLElement).isContentEditable)
            ) {
                return;
            }
            el.focus({ preventScroll: false });
        }
    }, [focusedIndex]);

    return (
        <div
            role="list"
            className={className}
            onKeyDown={(e) => {
                // Allow the container to receive key events when nothing inside
                // is focused, so the user can navigate immediately after mount.
                if (
                    items.length > 0 &&
                    !e.defaultPrevented &&
                    (e.key === "ArrowDown" ||
                        e.key === "ArrowUp" ||
                        e.key === "ArrowLeft" ||
                        e.key === "ArrowRight")
                ) {
                    handleItemKeyDown(
                        e as unknown as KeyboardEvent<HTMLElement>,
                        focusedIndex
                    );
                }
            }}
        >
            {items.map((item, index) => (
                <RovingItemSlot
                    key={getKey(item, index)}
                    index={index}
                    focusedIndex={focusedIndex}
                    setRef={(el) => {
                        itemRefs.current[index] = el;
                    }}
                    onKeyDown={handleItemKeyDown}
                >
                    {(itemProps, isFocused) =>
                        renderItem(item, index, { itemProps, isFocused })
                    }
                </RovingItemSlot>
            ))}
        </div>
    );
}

function clampIndex(i: number, length: number) {
    if (length === 0) return 0;
    return Math.max(0, Math.min(i, length - 1));
}

interface SlotProps {
    index: number;
    focusedIndex: number;
    setRef: (el: HTMLElement | null) => void;
    onKeyDown: (e: KeyboardEvent<HTMLElement>, index: number) => void;
    children: (
        itemProps: RovingListRenderProps<unknown>["itemProps"],
        isFocused: boolean
    ) => ReactNode;
}

function RovingItemSlot({
    index,
    focusedIndex,
    setRef,
    onKeyDown,
    children,
}: SlotProps) {
    const isFocused = index === focusedIndex;
    const itemProps = {
        tabIndex: isFocused ? 0 : -1,
        ref: setRef,
        onKeyDown: (e: KeyboardEvent<HTMLElement>) => onKeyDown(e, index),
    } as const;
    return <>{children(itemProps, isFocused)}</>;
}