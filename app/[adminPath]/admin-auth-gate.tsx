// app/[adminPath]/admin-auth-gate.tsx
//
// Renders the admin login form when the visitor is unauthenticated.
// Used by /[adminPath]/layout.tsx. Client component because the
// password input + submit handler lives here.

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Mode = "login" | "not-configured";

export function AdminAuthGate({
    mode,
    children,
}: {
    mode: Mode;
    children: React.ReactNode;
}) {
    if (mode === "not-configured") {
        return (
            <main className="min-h-screen bg-gradient-to-b from-black to-gray-900 text-white flex items-center justify-center p-4">
                <div className="bg-gray-800/70 p-8 rounded-lg shadow-2xl w-full max-w-md text-center glow-box">
                    <h1 className="text-2xl font-bold mb-4">Admin not configured</h1>
                    <p className="text-sm text-gray-300">
                            Set <code className="bg-gray-700 px-1 rounded">ADMIN_PASSWORD_HASH</code>
                            {" "}and{" "}
                            <code className="bg-gray-700 px-1 rounded">ADMIN_SESSION_SECRET</code>
                            {" "}in <code className="bg-gray-700 px-1 rounded">.env.local</code>{" "}
                            and restart the dev server.
                        </p>
                </div>
            </main>
        );
    }

    return <LoginForm onSuccess={undefined}>{children}</LoginForm>;
}

function LoginForm({ children }: { children: React.ReactNode }) {
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);
        setSubmitting(true);
        try {
            const res = await fetch("/api/admin/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password }),
            });
            if (res.status === 204) {
                // Cookie is set by the response. Reload so the layout
                // re-runs the auth gate and shows the protected child.
                window.location.reload();
                return;
            }
            if (res.status === 429) {
                const ra = res.headers.get("retry-after") ?? "?";
                setError(`Too many attempts. Try again in ${ra}s.`);
                return;
            }
            if (res.status === 503) {
                setError("Admin not configured on the server.");
                return;
            }
            setError("Incorrect password.");
        } catch {
            setError("Network error. Please retry.");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <main className="min-h-screen bg-gradient-to-b from-black to-gray-900 text-white flex items-center justify-center p-4">
            <form
                onSubmit={onSubmit}
                className="bg-gray-800/70 p-8 rounded-xl shadow-2xl w-full max-w-md glow-box"
            >
                <h1 className="text-2xl font-bold text-center text-white mb-6">
                    Admin login
                </h1>
                <div className="space-y-4">
                    <Input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-gray-700 border-gray-600 focus:border-purple-500 text-white"
                        required
                        autoFocus
                    />
                    <Button
                        type="submit"
                        className="w-full bg-gradient-to-r from-purple-700 to-purple-500 hover:from-purple-600 hover:to-purple-400"
                        disabled={submitting || !password}
                    >
                        {submitting ? "Signing in…" : "Sign in"}
                    </Button>
                    {error && (
                        <p className="text-sm text-red-400 text-center">{error}</p>
                    )}
                </div>
                {/* `children` here is the protected admin content. At v0 it's
                    unused (the only page is the login itself), but having the
                    gate render children preserves the layout's intent for future
                    pages. */}
                <div className="hidden">{children}</div>
            </form>
        </main>
    );
}