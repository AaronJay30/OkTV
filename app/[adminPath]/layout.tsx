// app/[adminPath]/layout.tsx
//
// Admin section shell. Enforces the secret-path gate AND the auth
// gate in one boundary, applied to every nested page.
//
// Per spec §4.3 (path gate) and §4.2 (auth gate):
//   - 404 (notFound()) if the URL segment doesn't match ADMIN_PATH_SLICE.
//   - 404 if the user isn't authenticated as admin.
//
// Both gates fail closed. The rendered login UI replaces the children
// when unauthenticated.
//
// Note: at v0 there are no other admin routes. Once we add /features,
// /keys, etc., they'll inherit this layout automatically — the layout
// never has to change.

import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import {
    ADMIN_COOKIE,
    getAdminPathSlice,
    getAdminConfigError,
    verifyAdminToken,
} from "@/lib/admin-auth";
import { AdminAuthGate } from "./admin-auth-gate";

export const dynamic = "force-dynamic";

interface LayoutProps {
    children: React.ReactNode;
    params: { adminPath: string };
}

export default function AdminLayout({ children, params }: LayoutProps) {
    // Spec §4.3: path gate first.
    // Internal hit (the dynamic segment) sees /<slice>/<whatever>; the
    // URL the user typed in the browser matches `params.adminPath`.
    // We compare to ADMIN_PATH_SLICE — defaults to console-0724.
    if (params.adminPath !== getAdminPathSlice()) {
        notFound();
    }

    // Path matches — we're inside the admin area. Now check auth.
    if (getAdminConfigError()) {
        // Layer 2 fail: admin isn't configured. Render a clear message.
        // Spec says return 503 on the API. On the page, we just show
        // a setup-needed panel and refuse to render protected children.
        return (
            <AdminAuthGate mode="not-configured">
                <>{children}</>
            </AdminAuthGate>
        );
    }

    const cookieStore = cookies();
    const tokenCookie = cookieStore.get(ADMIN_COOKIE);
    const verify = verifyAdminToken(tokenCookie?.value);

    if (!verify.ok) {
        return (
            <AdminAuthGate mode="login">
                <>{children}</>
            </AdminAuthGate>
        );
    }

    return <>{children}</>;
}