// app/[adminPath]/features/page.tsx
//
// Spec 04 §8 Features page. Card grid; each card is a feature flag
// with a click-to-toggle radio indicator.
//
// Layout (per spec):
//   - Search box at top
//   - Cards in a single-column responsive grid
//   - Each card: ~20% left icon, ~80% right name+description,
//     top-right radio indicator (filled/hollow dot)
//   - Click anywhere on the card toggles the flag

"use client";

import { useEffect, useMemo, useState } from "react";
import { Mic2, Star, Loader2 as LoaderIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import type { Flags } from "@/hooks/use-flags";

interface Feature {
    key: keyof Flags;
    name: string;
    description: string;
    Icon: React.ComponentType<{ className?: string }>;
}

const FEATURES: Feature[] = [
    {
        key: "phoneMicEnabled",
        name: "Phone as Microphone",
        description: "Allow users to use their phones as microphones.",
        Icon: Mic2,
    },
    {
        key: "scorerEnabled",
        name: "Karaoke Scorer",
        description: "Show a random score after each performance.",
        Icon: Star,
    },
    // Note: the create-room modal is not a manual toggle. It's derived:
    // shown when any feature above is on, skipped when both are off
    // (see shouldSkipCreateRoomModal in hooks/use-flags.ts).
];

const CSRF_HEADER = "X-Admin-CSRF";

function getCsrfCookie(): string | null {
    if (typeof document === "undefined") return null;
    const match = document.cookie.match(/(?:^|;\s*)oktv_csrf=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
}

export default function FeaturesPage() {
    const { toast } = useToast();
    const [flags, setFlags] = useState<Flags | null>(null);
    const [search, setSearch] = useState("");
    const [saving, setSaving] = useState<keyof Flags | null>(null);

    useEffect(() => {
        let alive = true;
        fetch("/api/admin/flags", { credentials: "include" })
            .then((r) => (r.ok ? (r.json() as Promise<Partial<Flags>>) : ({} as Partial<Flags>)))
            .then((data) => {
                if (!alive) return;
                setFlags({
                    phoneMicEnabled: !!data?.phoneMicEnabled,
                    scorerEnabled: !!data?.scorerEnabled,
                });
            })
            .catch(() => {
                /* tolerate — RTDB may be empty; defaults still apply */
            });
        return () => {
            alive = false;
        };
    }, []);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return FEATURES;
        return FEATURES.filter(
            (f) =>
                f.name.toLowerCase().includes(q) ||
                f.description.toLowerCase().includes(q),
        );
    }, [search]);

    async function toggle(f: Feature) {
        if (!flags) return;
        const next = { ...flags, [f.key]: !flags[f.key] };
        setFlags(next); // optimistic
        setSaving(f.key);
        try {
            const csrf = getCsrfCookie() ?? "";
            const res = await fetch("/api/admin/flags", {
                method: "PUT",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    [CSRF_HEADER]: csrf,
                },
                body: JSON.stringify(next),
            });
            if (!res.ok) {
                // re-fetch authoritative state on rejection
                setFlags(flags);
                toast({
                    title: "Could not save flag",
                    description: `Server returned ${res.status}.`,
                    variant: "destructive",
                });
            }
        } catch {
            setFlags(flags);
            toast({
                title: "Network error",
                description: "Could not save flag.",
                variant: "destructive",
            });
        } finally {
            setSaving(null);
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-black to-gray-900 text-white p-6 md:p-10">
            <header className="mb-6">
                <h1 className="text-2xl font-bold mb-2">Features</h1>
                <p className="text-sm text-gray-400 mb-4">
                    Toggle what guests can use. Changes apply to all rooms
                    immediately.
                </p>
                <Input
                    type="search"
                    placeholder="Search features…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="bg-gray-800 border-gray-700 max-w-md"
                />
            </header>

            {flags === null ? (
                <div className="flex items-center gap-2 text-gray-400">
                    <LoaderIcon className="h-4 w-4 animate-spin" />
                    Loading…
                </div>
            ) : (
                <ul className="grid grid-cols-1 gap-3 max-w-2xl">
                    {filtered.map((f) => {
                        const enabled = flags[f.key];
                        const isSaving = saving === f.key;
                        return (
                            <li key={f.key}>
                                <Card
                                    role="button"
                                    tabIndex={0}
                                    aria-pressed={enabled}
                                    onClick={() => toggle(f)}
                                    onKeyDown={(e) => {
                                        if (
                                            e.key === "Enter" ||
                                            e.key === " "
                                        ) {
                                            e.preventDefault();
                                            toggle(f);
                                        }
                                    }}
                                    className={
                                        "flex items-stretch gap-4 p-3 cursor-pointer transition-colors bg-gray-800/70 border " +
                                        (enabled
                                            ? "border-purple-500/50 hover:border-purple-400"
                                            : "border-gray-700 hover:border-gray-600")
                                    }
                                >
                                    {/* Left ~20%: icon */}
                                    <div className="flex items-center justify-center w-14 shrink-0">
                                        <f.Icon
                                            className={
                                                "h-7 w-7 " +
                                                (enabled
                                                    ? "text-purple-300"
                                                    : "text-gray-500")
                                            }
                                        />
                                    </div>

                                    {/* Right ~80%: name + description */}
                                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                                        <p className="font-medium">
                                            {f.name}
                                        </p>
                                        <p className="text-xs text-gray-400">
                                            {f.description}
                                        </p>
                                    </div>

                                    {/* Top-right: radio indicator */}
                                    <div className="flex flex-col items-center justify-center w-20 shrink-0">
                                        <span
                                            aria-hidden="true"
                                            className={
                                                "inline-block h-3 w-3 rounded-full border-2 " +
                                                (enabled
                                                    ? "bg-purple-400 border-purple-300"
                                                    : "bg-transparent border-gray-500")
                                            }
                                        />
                                        <span className="mt-1 text-[10px] uppercase tracking-wide text-gray-400">
                                            {isSaving
                                                ? "Saving"
                                                : enabled
                                                  ? "Enabled"
                                                  : "Disabled"}
                                        </span>
                                    </div>
                                </Card>
                            </li>
                        );
                    })}
                    {filtered.length === 0 && (
                        <li className="text-gray-500 italic">
                            No features match “{search}”.
                        </li>
                    )}
                </ul>
            )}
        </div>
    );
}