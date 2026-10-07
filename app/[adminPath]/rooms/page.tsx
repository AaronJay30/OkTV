"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useFirebaseValue } from "@/lib/firebase-hooks";
import { normalizeRoom } from "@/lib/admin-room";

function csrf() { return document.cookie.split("; ").find((x) => x.startsWith("oktv_csrf="))?.split("=")[1] ?? ""; }
function ago(value: number | null) { return value ? `${Math.max(0, Math.round((Date.now() - value) / 3600000))}h ago` : "unknown"; }

export default function RoomsPage() {
    const [raw, loading] = useFirebaseValue<Record<string, unknown> | null>("rooms", null);
    const [open, setOpen] = useState<string | null>(null);
    const [selected, setSelected] = useState<string[]>([]);
    const [busy, setBusy] = useState(false);
    const rooms = useMemo(() => Object.entries(raw ?? {}).map(([id, room]) => normalizeRoom(id, room)), [raw]);
    const refresh = () => window.location.reload();
    async function deleteRooms(ids: string[]) {
        if (!ids.length || !window.confirm(`Delete ${ids.length} room(s)?`)) return;
        setBusy(true);
        await Promise.all(ids.map((id) => fetch(`/api/admin/rooms/${encodeURIComponent(id)}`, { method: "DELETE", headers: { "X-Admin-CSRF": csrf() }, credentials: "include" })));
        setSelected([]); setBusy(false); refresh();
    }
    async function purge() {
        const input = window.prompt("Delete rooms idle longer than how many hours?", "24");
        const hours = Number(input); if (!Number.isFinite(hours) || hours <= 0) return;
        setBusy(true);
        await fetch("/api/admin/rooms", { method: "POST", headers: { "Content-Type": "application/json", "X-Admin-CSRF": csrf() }, body: JSON.stringify({ hours }), credentials: "include" });
        setBusy(false); refresh();
    }
    return <div className="min-h-screen bg-gradient-to-b from-black to-gray-900 text-white p-6 md:p-10">
        <header className="mb-6 flex items-center justify-between gap-3 flex-wrap"><div><h1 className="text-2xl font-bold">Rooms</h1><p className="text-sm text-gray-400">Live room activity and cleanup.</p></div><div className="flex gap-2"><Button variant="outline" size="sm" onClick={refresh}><RefreshCw className="h-4 w-4 mr-1" />Refresh</Button><Button variant="outline" size="sm" onClick={purge} disabled={busy}><Trash2 className="h-4 w-4 mr-1" />Purge idle</Button></div></header>
        {selected.length > 0 && <div className="sticky bottom-4 z-10 mb-3 flex items-center justify-between rounded border border-red-500/40 bg-gray-900 p-3"><span>{selected.length} selected</span><Button variant="destructive" size="sm" onClick={() => deleteRooms(selected)} disabled={busy}>Delete selected</Button></div>}
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : rooms.length === 0 ? <p className="text-gray-400">No rooms found.</p> : <div className="space-y-2">{rooms.map((room) => { const isOpen = open === room.id; const checked = selected.includes(room.id); const currentTitle = room.currentSong && typeof room.currentSong === "object" ? String((room.currentSong as Record<string, unknown>).title ?? "—") : "—"; return <div key={room.id} className="rounded border border-gray-700 bg-gray-800/60"><div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => setOpen(isOpen ? null : room.id)}><button aria-label={isOpen ? "Collapse room" : "Expand room"}>{isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button><Checkbox checked={checked} onCheckedChange={(v) => setSelected((current) => v ? [...current, room.id] : current.filter((id) => id !== room.id))} onClick={(e) => e.stopPropagation()} /><div className="min-w-0 flex-1"><p className="font-mono truncate">{room.id}</p><p className="text-xs text-gray-400">{ago(room.lastActivity)} · {Object.keys(room.users).length} users · {currentTitle}</p></div><Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); deleteRooms([room.id]); }}><Trash2 className="h-4 w-4" /></Button></div>{isOpen && <div className="grid gap-4 border-t border-gray-700 p-4 text-sm md:grid-cols-3"><section><h2 className="font-semibold mb-2">Users</h2>{Object.entries(room.users).map(([id, user]) => <p key={id} className="text-gray-300">{String((user as any)?.name ?? id)} · {String((user as any)?.lastSeen ?? (user as any)?.joinedAt ?? "unknown")}</p>)}</section><section><h2 className="font-semibold mb-2">Queue</h2>{Object.values(room.queue).map((song: any, i) => <p key={i} className="text-gray-300">{song?.title ?? "Untitled"}</p>)}</section><section><h2 className="font-semibold mb-2">Scores</h2>{room.scorerEnabled ? Object.values(room.scores).map((score: any, i) => <p key={i} className="text-gray-300">{score?.userName ?? "User"} · {score?.score ?? 0}</p>) : <p className="text-gray-500">Scorer is disabled.</p>}</section></div>}</div>})}</div>}
    </div>;
}
