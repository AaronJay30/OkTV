// app/[adminPath]/admin-logout-button.tsx
//
// Sign-out control placed in the sidebar footer. POSTs to
// /api/admin/logout (which clears both cookies) and reloads so the
// layout re-runs the auth gate and shows the login form again.

"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export function LogoutButton() {
    const { toast } = useToast();
    const [busy, setBusy] = useState(false);

    async function onClick() {
        if (busy) return;
        setBusy(true);
        try {
            const res = await fetch("/api/admin/logout", {
                method: "POST",
                credentials: "include",
            });
            if (res.ok) {
                // Force a reload so the layout's auth gate re-runs
                // and the login form comes back.
                window.location.reload();
                return;
            }
            toast({
                title: "Sign out failed",
                description: `Server returned ${res.status}.`,
                variant: "destructive",
            });
        } catch {
            toast({
                title: "Sign out failed",
                description: "Network error.",
                variant: "destructive",
            });
        } finally {
            setBusy(false);
        }
    }

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={busy}
            className={
                "flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm " +
                "text-gray-300 hover:text-white hover:bg-gray-800/60 " +
                "disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            }
        >
            <LogOut className="h-4 w-4" />
            <span>{busy ? "Signing out…" : "Sign out"}</span>
        </button>
    );
}