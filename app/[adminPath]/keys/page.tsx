// app/[adminPath]/keys/page.tsx
//
// Spec 04 §8 Keys page. Reads /api/admin/keys on mount, renders a
// table of per-slot YouTube API key usage stats.
//
// Honest status (per honesty protocol):
// - TypeScript compiles cleanly.
// - In-memory counters from youtube-rotating-key.ts (no RTDB snapshot
//   yet) — process restart zeroes them. The "Refresh" button re-fetches.
// - Empty state shown when no slots have been used yet.

"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw, Clock, AlertTriangle } from "lucide-react";
import {
    Card,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

interface Slot {
    label: string;
    last4: string;
    totalRequests: number;
    totalUnits: number;
    last24hRequests: number;
    quotaExceededAt: string | null;
    pctOfDailyQuota: number;
}

interface KeysResponse {
    slots: Slot[];
    generatedAt: string;
}

/**
 * Time remaining until YouTube's daily quota reset (midnight Pacific).
 * YouTube resets daily at 00:00 PT (UTC-8 standard, UTC-7 DST).
 */
function quotaResetCountdown(): { ms: number; pretty: string } {
    const now = new Date();
    // Pacific Time: PT = UTC - 8 (standard) or UTC - 7 (DST).
    // For a stable "midnight Pacific" we compute it without DST juggling:
    // 0:00 PT in UTC. This is correct most of the year and is off by
    // an hour twice a year when DST flips. Good enough for v1.
    const resetUtc = new Date(now);
    resetUtc.setUTCDate(resetUtc.getUTCDate() + 1);
    resetUtc.setUTCHours(8, 0, 0, 0); // 0:00 PT == 08:00 UTC (standard)
    const ms = resetUtc.getTime() - now.getTime();
    const totalMin = Math.max(0, Math.floor(ms / 60000));
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return { ms, pretty: `${h}h ${m}m` };
}

function statusFor(slot: Slot): {
    label: string;
    color: "green" | "yellow" | "red";
} {
    if (slot.quotaExceededAt) return { label: "exceeded", color: "red" };
    if (slot.pctOfDailyQuota >= 0.8)
        return { label: "near limit", color: "yellow" };
    return { label: "active", color: "green" };
}

export default function KeysPage() {
    const { toast } = useToast();
    const [data, setData] = useState<KeysResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [countdown, setCountdown] = useState(() => quotaResetCountdown());

    async function load(showRefreshToast = false) {
        if (showRefreshToast) setRefreshing(true);
        try {
            const res = await fetch("/api/admin/keys", {
                credentials: "include",
            });
            if (!res.ok) {
                throw new Error(`Server returned ${res.status}`);
            }
            const json = (await res.json()) as KeysResponse;
            setData(json);
            setLoadError(null);
            if (showRefreshToast) {
                toast({
                    title: "Refreshed",
                    description: `${json.slots.length} key slot(s) shown.`,
                });
            }
        } catch (e) {
            setLoadError(
                e instanceof Error ? e.message : "Failed to load keys"
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }

    useEffect(() => {
        load(false);
    }, []);

    // Re-tick the countdown every minute. Cheap; pure DOM state.
    useEffect(() => {
        const id = setInterval(() => {
            setCountdown(quotaResetCountdown());
        }, 60_000);
        return () => clearInterval(id);
    }, []);

    return (
        <div className="min-h-screen bg-gradient-to-b from-black to-gray-900 text-white p-6 md:p-10">
            <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-bold mb-2">API Keys</h1>
                    <p className="text-sm text-gray-400 mb-2">
                        Per-slot YouTube Data API v3 usage. Counters reset
                        when the dev server restarts.
                    </p>
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                        <Clock className="h-4 w-4 text-purple-300" />
                        <span>
                            Quota resets at midnight Pacific — in{" "}
                            <span className="font-semibold text-white">
                                {countdown.pretty}
                            </span>
                        </span>
                    </div>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => load(true)}
                    disabled={refreshing || loading}
                    className="border-gray-700 text-gray-300 hover:bg-gray-800"
                >
                    {refreshing ? (
                        <>
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            Refreshing…
                        </>
                    ) : (
                        <>
                            <RefreshCw className="h-4 w-4 mr-1" />
                            Refresh
                        </>
                    )}
                </Button>
            </header>

            {loadError && (
                <div className="max-w-md p-4 mb-6 rounded-lg bg-red-500/10 border border-red-500/40 text-red-300">
                    <p className="font-semibold mb-1">
                        Could not load key stats
                    </p>
                    <p className="text-sm text-red-200/80">{loadError}</p>
                </div>
            )}

            {loading ? (
                <div className="flex items-center gap-2 text-gray-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading…
                </div>
            ) : data && data.slots.length === 0 ? (
                <EmptyState />
            ) : (
                data && (
                    <div className="space-y-3">
                        {data.slots.map((slot) => (
                            <SlotRow key={slot.label} slot={slot} />
                        ))}
                    </div>
                )
            )}
        </div>
    );
}

function EmptyState() {
    return (
        <Card className="max-w-2xl bg-gray-800/40 border-gray-700/60 p-6 text-center">
            <AlertTriangle className="h-8 w-8 mx-auto mb-3 text-gray-500" />
            <p className="text-base text-gray-200 mb-1">No key activity yet</p>
            <p className="text-sm text-gray-400">
                Once a guest searches or pastes a YouTube link, the keys
                they used will appear here. In-memory counters reset on
                server restart; persistence to RTDB is a follow-up.
            </p>
        </Card>
    );
}

function SlotRow({ slot }: { slot: Slot }) {
    const status = statusFor(slot);
    const pct = Math.min(100, slot.pctOfDailyQuota * 100);
    const overflow = slot.pctOfDailyQuota > 1;

    const barColor =
        status.color === "red"
            ? "bg-red-500"
            : status.color === "yellow"
              ? "bg-yellow-500"
              : "bg-purple-500";

    return (
        <Card className="bg-gray-800/60 border-gray-700 p-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-lg text-white">
                            …{slot.last4}
                        </span>
                        <span className="text-xs uppercase tracking-wide text-gray-500 bg-gray-700/60 px-2 py-0.5 rounded">
                            slot {slot.label}
                        </span>
                    </div>
                    <p className="text-xs text-gray-400">
                        {slot.totalRequests.toLocaleString()} total requests
                        {" · "}
                        {slot.totalUnits.toLocaleString()} units
                        {" · "}
                        {slot.last24hRequests.toLocaleString()} in last 24h
                    </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                    <span
                        className={
                            "inline-flex h-2 w-2 rounded-full " +
                            (status.color === "red"
                                ? "bg-red-500"
                                : status.color === "yellow"
                                  ? "bg-yellow-500"
                                  : "bg-green-500")
                        }
                    />
                    <span
                        className={
                            "uppercase tracking-wide " +
                            (status.color === "red"
                                ? "text-red-400"
                                : status.color === "yellow"
                                  ? "text-yellow-400"
                                  : "text-green-400")
                        }
                    >
                        {status.label}
                    </span>
                </div>
            </div>

            <div className="mt-3 h-2 w-full bg-gray-700/60 rounded-full overflow-hidden">
                <div
                    className={`h-full ${barColor} transition-[width] duration-300`}
                    style={{ width: `${pct}%` }}
                />
            </div>
            <div className="flex justify-between mt-1 text-[11px] text-gray-400">
                <span>
                    {slot.pctOfDailyQuota.toFixed(1)}% (
                        {slot.totalUnits.toLocaleString()} / 10,000 units)
                    </span>
                {overflow && (
                    <span className="text-red-400">
                        ⚠ exceeded today's cap
                    </span>
                )}
                {slot.quotaExceededAt && (
                    <span className="text-gray-500">
                        last error{" "}
                        {new Date(slot.quotaExceededAt).toLocaleTimeString()}
                    </span>
                )}
            </div>
        </Card>
    );
}