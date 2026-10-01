// app/[adminPath]/admin-sidebar-nav.tsx
//
// Sidebar nav for the admin area. Shows the four spec-04 sections in
// order: Analytics / Features / Rooms / Audit. Pages that don't exist
// yet are greyed out and non-navigable — they're "future" entries that
// preview what the dashboard will contain.
//
// Brand header mirrors the home page's OkTV text logo so admin feels
// like a sibling of the main app. On mobile the shadcn sidebar becomes
// a Sheet triggered by SidebarTrigger (rendered in the layout inset).

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, ListChecks, Server, ListOrdered } from "lucide-react";
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarFooter,
} from "@/components/ui/sidebar";
import { getAdminPathSlice } from "@/lib/admin-auth";
import { LogoutButton } from "./admin-logout-button";

interface NavEntry {
    label: string;
    href: string;
    Icon: React.ComponentType<{ className?: string }>;
    live: boolean;
}

function buildEntries(slice: string): NavEntry[] {
    return [
        { label: "Analytics", href: `/${slice}/keys`, Icon: BarChart3, live: true },
        { label: "Features", href: `/${slice}/features`, Icon: ListChecks, live: true },
        { label: "Rooms", href: `/${slice}/rooms`, Icon: Server, live: false },
        { label: "Audit", href: `/${slice}/audit`, Icon: ListOrdered, live: false },
    ];
}

export function AdminSidebarNav() {
    const pathname = usePathname();
    const slice = getAdminPathSlice();
    const entries = buildEntries(slice);

    return (
        <Sidebar>
            <SidebarHeader className="border-b border-gray-800/60 bg-gradient-to-b from-gray-900/80 to-gray-900/30">
                <div className="flex items-baseline gap-1 px-2 py-1 select-none">
                    <span className="text-2xl font-extrabold text-white tracking-tight glow">
                        Ok
                    </span>
                    <span className="text-2xl font-extrabold text-purple-500 tracking-tight">
                        TV
                    </span>
                    <span className="ml-2 text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium">
                        Admin
                    </span>
                </div>
            </SidebarHeader>
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {entries.map((e) => {
                                const isActive = pathname === e.href;
                                const activeClass =
                                    "bg-purple-500/15 text-white ring-1 ring-purple-400/40 shadow-[inset_0_0_0_1px_rgba(168,85,247,0.15)]";
                                const idleClass =
                                    "text-gray-300 hover:bg-gray-800/60 hover:text-white";
                                if (!e.live) {
                                    return (
                                        <SidebarMenuItem key={e.href}>
                                            <SidebarMenuButton
                                                disabled
                                                aria-disabled="true"
                                                className={
                                                    "opacity-40 cursor-not-allowed " +
                                                    idleClass
                                                }
                                                title="Coming in a later slice"
                                            >
                                                <e.Icon className="h-4 w-4" />
                                                <span>{e.label}</span>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                    );
                                }
                                return (
                                    <SidebarMenuItem key={e.href}>
                                        <SidebarMenuButton asChild>
                                            <Link
                                                href={e.href}
                                                className={
                                                    isActive
                                                        ? activeClass
                                                        : idleClass
                                                }
                                            >
                                                <e.Icon className="h-4 w-4" />
                                                <span>{e.label}</span>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                );
                            })}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
            <SidebarFooter className="border-t border-gray-800/60">
                <LogoutButton />
            </SidebarFooter>
        </Sidebar>
    );
}