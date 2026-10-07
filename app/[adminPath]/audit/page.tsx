"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

export default function AuditPage() {
    const [entries, setEntries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => { fetch("/api/admin/audit", { credentials: "include" }).then((r) => r.json()).then((v) => setEntries(v.entries ?? [])).finally(() => setLoading(false)); }, []);
    return <div className="min-h-screen bg-gradient-to-b from-black to-gray-900 text-white p-6 md:p-10"><h1 className="text-2xl font-bold mb-2">Audit</h1><p className="text-sm text-gray-400 mb-6">The latest administrative actions.</p>{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : entries.length === 0 ? <p className="text-gray-400">No audit entries yet.</p> : <div className="overflow-auto rounded border border-gray-700"><table className="w-full text-left text-sm"><thead className="bg-gray-800"><tr><th className="p-3">Time</th><th className="p-3">Action</th><th className="p-3">Detail</th></tr></thead><tbody>{entries.map((entry) => <tr key={entry.id} className="border-t border-gray-800"><td className="p-3 whitespace-nowrap">{new Date(entry.at).toLocaleString()}</td><td className="p-3">{entry.action}</td><td className="p-3 font-mono text-xs">{JSON.stringify(entry.detail)}</td></tr>)}</tbody></table></div>}</div>;
}
