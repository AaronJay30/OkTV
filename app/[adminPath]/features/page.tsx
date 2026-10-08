// app/[adminPath]/features/page.tsx
//
// Spec 04 §8 Features page. Each card has separate enabled and
// experimental switches for one feature.
//
// Layout (per spec):
//   - Search box at top
//   - Cards in a single-column responsive grid
//   - Each card: icon, name and description, plus independent switches

"use client";

import { useEffect, useMemo, useState } from "react";
import { Mic2, Star, SmilePlus, Loader2 as LoaderIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { AdminFeatureToggles } from "@/components/admin-feature-toggles";
import type { Flags } from "@/hooks/use-flags";

interface Feature {
    key: "phoneMicEnabled" | "scorerEnabled" | "reactionsEnabled";
    experimentalKey:
        | "phoneMicExperimental"
        | "scorerExperimental"
        | "reactionsExperimental";
    name: string;
    description: string;
    Icon: React.ComponentType<{ className?: string }>;
}

const FEATURES: Feature[] = [
    {
        key: "phoneMicEnabled",
        experimentalKey: "phoneMicExperimental",
        name: "Phone as Microphone",
        description: "Allow users to use their phones as microphones.",
        Icon: Mic2,
    },
    {
        key: "scorerEnabled",
        experimentalKey: "scorerExperimental",
        name: "Karaoke Scorer",
        description: "Show a random score after each performance.",
        Icon: Star,
    },
    {
        key: "reactionsEnabled",
        experimentalKey: "reactionsExperimental",
        name: "Live Reactions",
        description: "Allow guests to send floating reactions in rooms.",
        Icon: SmilePlus,
    },
    // The create-room modal is derived from enabled feature flags.
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
    const [loadError, setLoadError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [saving, setSaving] = useState<keyof Flags | null>(null);

    useEffect(() => {
        let alive = true;
        fetch("/api/admin/flags", { credentials: "include" })
            .then((r) =>
                r.ok
                    ? (r.json() as Promise<Partial<Flags>>)
                    : Promise.reject(
                          new Error(`Server returned ${r.status}`)
                      )
            )
            .then((data) => {
                if (!alive) return;
                setFlags({
                    phoneMicEnabled: !!data?.phoneMicEnabled,
                    scorerEnabled: !!data?.scorerEnabled,
                    reactionsEnabled: !!data?.reactionsEnabled,
                    phoneMicExperimental: data?.phoneMicExperimental === true,
                    scorerExperimental: data?.scorerExperimental === true,
                    reactionsExperimental: data?.reactionsExperimental === true,
                });
                setLoadError(null);
            })
            .catch((e) => {
                // SPEC HONESTY: this catch previously returned an empty
                // object, which the page rendered as 'all flags disabled'.
                // That was a silent data-loss bug — toggles appeared to
                // persist while the server actually failed to read them.
                // Surface the failure so the user can fix RTDB rules.
                if (!alive) return;
                setLoadError(
                    e instanceof Error ? e.message : "Failed to load flags"
                );
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

    async function toggle(key: keyof Flags) {
        if (!flags) return;
        const next = { ...flags, [key]: !flags[key] };
        setFlags(next); // optimistic
        setSaving(key);
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

            {loadError ? (
                <div className="max-w-2xl p-4 rounded-lg bg-red-500/10 border border-red-500/40 text-red-300">
                    <p className="font-semibold mb-1">Could not load flags</p>
                    <p className="text-sm text-red-200/80">
                        {loadError}. The most common cause is RTDB rules
                        blocking reads. Update your Firebase rules so{" "}
                        <code className="bg-gray-800 px-1 rounded">
                            /config/flags
                        </code>{" "}
                        is publicly readable, then refresh.
                    </p>
                </div>
            ) : flags === null ? (
                <div className="flex items-center gap-2 text-gray-400">
                    <LoaderIcon className="h-4 w-4 animate-spin" />
                    Loading…
                </div>
            ) : (
                <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {filtered.map((f) => {
                        const enabled = flags[f.key];
                        const isSaving = saving === f.key || saving === f.experimentalKey;
                        return (
                            <li key={f.key}>
                                <Card
                                    className={
                                        "flex items-stretch gap-4 p-3 transition-colors bg-gray-800/70 border " +
                                        (enabled
                                            ? "border-purple-500/50"
                                            : "border-gray-700")
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
                                        {isSaving && (
                                            <p className="text-[10px] text-gray-400">Saving…</p>
                                        )}
                                    </div>

                                    <AdminFeatureToggles
                                        name={f.name}
                                        enabled={enabled}
                                        experimental={flags[f.experimentalKey]}
                                        disabled={saving !== null}
                                        onEnabledChange={() => void toggle(f.key)}
                                        onExperimentalChange={() =>
                                            void toggle(f.experimentalKey)
                                        }
                                    />
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
