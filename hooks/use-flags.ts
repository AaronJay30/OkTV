// hooks/use-flags.ts
//
// Client-side subscription to RTDB config/flags. Spec 04 §7.
//
// Behavior:
//   - On mount, subscribe to config/flags via onValue.
//   - Defaults: every flag is `true` when config/flags is absent, so
//     the app behaves identically to today before any admin ever
//     visits the dashboard.
//   - When any flag is explicitly written to false, components re-render
//     and the UI hides the corresponding feature.
//
// Notes:
//   - This is a CLIENT-side hide. For server-side enforcement at the
//     RTDB rules level, see specs/04-admin-dashboard.md §7 and the
//     rules snippet in the Firebase Realtime Database console.
//   - Single source of truth for the join page's "skip modal" decision
//     (spec §7 last bullet): when ALL flags are off OR when the modal
//     flag itself is off, the modal is skipped and createRoom is
//     called directly.

"use client";

import { useFirebaseValue } from "@/lib/firebase-hooks";
import {
    normalizeFlags,
    shouldSkipCreateRoomModal,
    type Flags,
} from "@/lib/feature-flags";

export type { Flags } from "@/lib/feature-flags";

export function useFlags(): { flags: Flags; loading: boolean } {
    // useFirebaseValue returns [value, loading, error]. We don't need
    // the error here — the defaults apply regardless and a toast on
    // RTDB outage is out of scope for v1.
    const [raw, loading] = useFirebaseValue<unknown>("config/flags", null);
    return { flags: normalizeFlags(raw), loading };
}

/**
 * Pure helper exported for tests / non-React callers.
 *
 * Per spec §7: skip the create-room modal whenever the user has no
 * features to configure — i.e., both phone mic and scorer are off.
 * (A standalone createRoomModalEnabled flag was originally specced,
 * but the modal-vs-skip behavior is fully derived from the two real
 * feature flags, so the manual toggle was removed.)
 */
export { shouldSkipCreateRoomModal };
