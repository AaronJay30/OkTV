import { get, push, ref, set } from "firebase/database";
import { rtdb } from "@/lib/firebase";

export async function writeAdminAudit(action: string, detail: Record<string, unknown>) {
    const entry = { at: new Date().toISOString(), action, detail };
    await set(push(ref(rtdb, "config/auditLog")), entry);
    return entry;
}

export async function readAdminAudit(limit = 50) {
    const snapshot = await get(ref(rtdb, "config/auditLog"));
    const raw = snapshot.exists() ? snapshot.val() : {};
    const entries = Object.entries(raw && typeof raw === "object" ? raw : {})
        .map(([id, value]) => ({ id, ...(value as Record<string, unknown>) })) as Array<{ id: string; at?: string; action?: string; detail?: unknown }>;
    return entries
        .sort((a, b) => String(b.at ?? "").localeCompare(String(a.at ?? "")))
        .slice(0, limit);
}
