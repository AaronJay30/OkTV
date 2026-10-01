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
// When authenticated, the layout renders a sidebar nav (Analytics /
// Features / Rooms / Audit) wrapping the page content.

import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import {
    ADMIN_COOKIE,
    getAdminPathSlice,
    getAdminConfigError,
    verifyAdminToken,
} from "@/lib/admin-auth";
import { AdminAuthGate } from "./admin-auth-gate";
import { AdminSidebarNav } from "./admin-sidebar-nav";
import {
    SidebarProvider,
    SidebarInset,
    SidebarTrigger,
} from "@/components/ui/sidebar";

export const dynamic = "force-dynamic";

interface LayoutProps {
    children: React.ReactNode;
    params: { adminPath: string };
}

export default function AdminLayout({ children, params }: LayoutProps) {
    // Spec §4.3: path gate first.
    if (params.adminPath !== getAdminPathSlice()) {
        notFound();
    }

    if (getAdminConfigError()) {
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
        // No sidebar in unauthenticated state — the login form is full-screen.
        return (
            <AdminAuthGate mode="login">
                <>{children}</>
            </AdminAuthGate>
        );
    }

    return (
        <SidebarProvider>
            <AdminSidebarNav />
            <SidebarInset>
                {/* Mobile: hamburger trigger sits at the top-left edge
                    of every admin page. On desktop the sidebar is open
                    so the trigger also works as an "open/close" handle. */}
                <header className="sticky top-0 z-10 flex h-12 items-center gap-2 border-b border-gray-800/60 bg-gray-900/60 px-3 backdrop-blur md:hidden">
                    <SidebarTrigger className="text-gray-300 hover:text-white" />
                    <span className="text-sm text-gray-400">Menu</span>
                </header>
                <>{children}</>
            </SidebarInset>
        </SidebarProvider>
    );
}