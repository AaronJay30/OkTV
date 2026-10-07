// app/[adminPath]/page.tsx
//
// Admin landing. Redirects authenticated users to the Keys / Analytics
// page (spec 04 §8 — analytics is the primary operational view, so it
// should be where you land after auth).

import { redirect } from "next/navigation";
import { getAdminPathSlice } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default function AdminHome() {
    redirect(`/${getAdminPathSlice()}/keys`);
}