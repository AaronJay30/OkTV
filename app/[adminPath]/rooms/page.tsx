"use client";

import { useMemo, useState } from "react";
import {
    ChevronDown,
    ChevronRight,
    Clock3,
    Loader2,
    Mic2,
    RefreshCw,
    Star,
    Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useFirebaseValue } from "@/lib/firebase-hooks";
import { normalizeRoom } from "@/lib/admin-room";

function csrf() {
    return document.cookie
        .split("; ")
        .find((cookie) => cookie.startsWith("oktv_csrf="))
        ?.split("=")[1] ?? "";
}

function ago(value: number | null) {
    if (!value) return "Unknown activity";
    const hours = Math.max(0, Math.round((Date.now() - value) / 3_600_000));
    return hours < 1 ? "Active within the last hour" : `Active ${hours}h ago`;
}

function asRecord(value: unknown): Record<string, any> {
    return value && typeof value === "object" ? value as Record<string, any> : {};
}

export default function RoomsPage() {
    const [raw, loading] = useFirebaseValue<Record<string, unknown> | null>("rooms", null);
    const [open, setOpen] = useState<string | null>(null);
    const [selected, setSelected] = useState<string[]>([]);
    const [busy, setBusy] = useState(false);
    const rooms = useMemo(
        () => Object.entries(raw ?? {}).map(([id, room]) => normalizeRoom(id, room)),
        [raw]
    );

    async function deleteRooms(ids: string[]) {
        if (!ids.length || !window.confirm(`Delete ${ids.length} room(s)?`)) return;
        setBusy(true);
        try {
            const responses = await Promise.all(ids.map((id) => fetch(
                `/api/admin/rooms/${encodeURIComponent(id)}`,
                {
                    method: "DELETE",
                    headers: { "X-Admin-CSRF": csrf() },
                    credentials: "include",
                }
            )));
            if (responses.some((response) => !response.ok)) throw new Error("Room deletion failed");
            setSelected([]);
        } catch (error) {
            window.alert(error instanceof Error ? error.message : "Room deletion failed");
        } finally {
            setBusy(false);
        }
    }

    async function purge() {
        const input = window.prompt("Delete rooms idle longer than how many hours?", "24");
        if (input === null) return;
        const hours = Number(input);
        if (!Number.isFinite(hours) || hours <= 0) return;
        setBusy(true);
        try {
            const response = await fetch("/api/admin/rooms", {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-Admin-CSRF": csrf() },
                body: JSON.stringify({ hours }),
                credentials: "include",
            });
            if (!response.ok) throw new Error("Room purge failed");
        } catch (error) {
            window.alert(error instanceof Error ? error.message : "Room purge failed");
        } finally {
            setBusy(false);
        }
    }

    return (
        <main className="min-h-screen bg-gradient-to-b from-black to-gray-900 p-6 text-white md:p-10">
            <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold">Rooms</h1>
                    <p className="text-sm text-gray-400">Room activity and enabled features.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                        <RefreshCw className="mr-1 h-4 w-4" /> Refresh
                    </Button>
                    <Button variant="outline" size="sm" onClick={purge} disabled={busy}>
                        <Trash2 className="mr-1 h-4 w-4" /> Purge idle
                    </Button>
                </div>
            </header>

            {selected.length > 0 && (
                <div className="sticky bottom-4 z-10 mb-3 flex items-center justify-between rounded border border-red-500/40 bg-gray-900 p-3">
                    <span>{selected.length} selected</span>
                    <Button variant="destructive" size="sm" onClick={() => deleteRooms(selected)} disabled={busy}>
                        Delete selected
                    </Button>
                </div>
            )}

            {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
            ) : rooms.length === 0 ? (
                <p className="text-gray-400">No rooms found.</p>
            ) : (
                <div className="space-y-3">
                    {rooms.map((room) => {
                        const isOpen = open === room.id;
                        const checked = selected.includes(room.id);
                        const users = asRecord(room.users);
                        const queue = asRecord(room.queue);
                        const scores = asRecord(room.scores);
                        const currentSong = asRecord(room.currentSong);
                        const scorerEnabled = room.scorerEnabled;

                        return (
                            <Card key={room.id} className="overflow-hidden border-gray-700 bg-gray-800/70">
                                <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_minmax(180px,0.55fr)_auto] md:items-center">
                                    <div className="flex min-w-0 items-center gap-3">
                                        <button
                                            type="button"
                                            aria-label={isOpen ? "Collapse room" : "Expand room"}
                                            className="shrink-0 text-gray-400 hover:text-white"
                                            onClick={() => setOpen(isOpen ? null : room.id)}
                                        >
                                            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                        </button>
                                        <Checkbox
                                            checked={checked}
                                            aria-label={`Select room ${room.id}`}
                                            onCheckedChange={(value) => setSelected((current) =>
                                                value ? [...current, room.id] : current.filter((id) => id !== room.id)
                                            )}
                                        />
                                        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOpen(isOpen ? null : room.id)}>
                                            <span className="block truncate font-mono text-sm font-semibold">{room.id}</span>
                                            <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
                                                <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" />{ago(room.lastActivity)}</span>
                                                <span>{Object.keys(users).length} users</span>
                                                <span className="max-w-56 truncate">{String(currentSong.title ?? "No song playing")}</span>
                                            </span>
                                        </button>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 md:border-l md:border-gray-700 md:pl-4">
                                        <span className="mr-1 text-xs text-gray-500">Features</span>
                                        {room.micFeatureEnabled && (
                                            <Badge variant="outline" className="gap-1 border-cyan-500/40 text-cyan-200">
                                                <Mic2 className="h-3 w-3" /> Microphone
                                            </Badge>
                                        )}
                                        {scorerEnabled && (
                                            <Badge variant="outline" className="gap-1 border-amber-500/40 text-amber-200">
                                                <Star className="h-3 w-3" /> Scorer
                                            </Badge>
                                        )}
                                        {!room.micFeatureEnabled && !scorerEnabled && <span className="text-xs text-gray-500">None enabled</span>}
                                    </div>

                                    <div className="flex items-center gap-2 md:justify-end">
                                        <Button variant="ghost" size="sm" onClick={() => setOpen(isOpen ? null : room.id)}>
                                            {isOpen ? "Hide details" : "Details"}
                                        </Button>
                                        <Button variant="ghost" size="icon" aria-label={`Delete room ${room.id}`} onClick={() => deleteRooms([room.id])} disabled={busy}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>

                                {isOpen && (
                                    <div className={`grid gap-4 border-t border-gray-700 bg-black/20 p-4 ${scorerEnabled ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
                                        <section>
                                            <h2 className="mb-2 text-sm font-semibold text-gray-200">Users</h2>
                                            {Object.entries(users).length ? Object.entries(users).map(([id, user]) => (
                                                <p key={id} className="py-1 text-sm text-gray-300">{String(asRecord(user).name ?? id)}</p>
                                            )) : <p className="text-sm text-gray-500">No users in this room.</p>}
                                        </section>
                                        <section>
                                            <h2 className="mb-2 text-sm font-semibold text-gray-200">Queue</h2>
                                            {Object.entries(queue).length ? Object.entries(queue).map(([id, song]) => (
                                                <p key={id} className="py-1 text-sm text-gray-300">{String(asRecord(song).title ?? "Untitled")}</p>
                                            )) : <p className="text-sm text-gray-500">No upcoming songs.</p>}
                                        </section>
                                        {scorerEnabled && (
                                            <section>
                                                <h2 className="mb-2 text-sm font-semibold text-gray-200">Scores</h2>
                                                {Object.entries(scores).length ? Object.entries(scores).map(([id, score]) => {
                                                    const value = asRecord(score);
                                                    return <p key={id} className="py-1 text-sm text-gray-300">{String(value.userName ?? "User")} · {String(value.songTitle ?? "Song")} · {String(value.score ?? 0)}</p>;
                                                }) : <p className="text-sm text-gray-500">No scores yet.</p>}
                                            </section>
                                        )}
                                    </div>
                                )}
                            </Card>
                        );
                    })}
                </div>
            )}
        </main>
    );
}
