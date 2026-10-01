# Spec 3 — TV Remote Navigation + Android TV APK Readiness

**Status:** Draft (not implemented)
**Branch:** `feature/tv-remote-navigation`
**Targets:** Google TV / Android TV (Leanback launcher), and any browser-based TV
(Chromium-based WebOS / Tizen / Apple TV browser). Primary target: Android TV.

---

## 1. Problem

OKtv is currently keyboard/mouse-first. On a TV remote:

- **No hover state** = no discovery of clickable elements.
- **No visible focus ring** = user can't tell where they are.
- **Click spam prevention** is fine, but there's no "long-press" / "OK" model.
- **Modals trap pointer events** but allow background scroll, which is disorienting
  on a 10-foot UI.
- **Search input requires keyboard text entry** — most TV remotes don't have one
  (only Google TV remote has a mic + on-screen keyboard).
- **`activeTab` switching** is mouse-only; needs D-pad Left/Right handling.

The room page is the entire karaoke UX. On a TV it becomes the karaoke display.

---

## 2. Goals

1. Every interactive element is reachable and visibly focused with **D-pad arrows**.
2. **OK / Enter** activates the focused element (button click, list item select).
3. **Back** button on the remote closes modals / dialogs (Radix Dialog already
   handles this; we just need to not block it).
4. Search input works with the **on-screen IME** (or voice mic if available).
5. **No content hidden behind hover** — hover-only affordances are moved to
   always-visible states.
6. The web app can be **packaged as an Android TV APK** that the Google TV
   launcher will surface under "Apps > Your apps".

---

## 3. Non-Goals

- Native Leanback activity rewrite in Kotlin/Java. We use a **WebView wrapper**
  (PWA / TWA), which is Google's recommended path for new apps.
- Voice / mic control (Google TV remote has a mic but voice commands for WebView
  apps need a MediaSession, which is out of scope).
- Gamepad rumble feedback.
- iOS / tvOS — the web app will work in Safari but no native tvOS packaging.
- Picture-in-picture for the YouTube player.

---

## 4. Design — Navigation (Web Side)

### 4.1 Focus Ring

Replace the default browser focus ring with a **visible TV-friendly ring**:
2-3px solid, color contrast ratio ≥ 3:1 against the background.

```css
/* Global — applies to anything focusable */
:focus-visible {
    outline: 3px solid #a78bfa;  /* purple-400, matches brand */
    outline-offset: 3px;
    border-radius: inherit;
    box-shadow: 0 0 0 6px rgba(167, 139, 250, 0.25);
}
button:focus-visible,
[role="button"]:focus-visible,
a:focus-visible {
    transform: scale(1.04);   /* subtle TV-friendly bump */
    transition: transform 120ms ease-out;
}
```

Remove all `outline: none` declarations from the codebase (search shows several
existing ones in `app/room/[id]/page.tsx`).

### 4.2 Roving Tabindex

The current code uses `Tabs` (Radix) for the search / queue / mic tabs. Radix
already implements the WAI-ARIA Tabs pattern with roving tabindex, so D-pad
**Left / Right** between tabs works out of the box. We verify and document.

For the **search results list** and **queue list**, we need roving tabindex:
one item is `tabIndex={0}` (the "focused" item), the rest are `tabIndex={-1}`.
**Up / Down** arrows move the focused item; **OK** activates it.

We'll add a small `<RovingList>` helper component (or use
`@react-aria/focus`'s `useFocusRing` + `FocusScope` if we want to avoid custom
keyboard handling). **Recommendation:** roll a 30-line custom hook rather than
add a dependency — our lists are simple and we already use Radix primitives.

### 4.3 OK / Enter Activation

For a `<button>`, `Enter` and `Space` already fire `click`. For a `<div role="button">`
or list item, we must add explicit `onKeyDown` handlers:
```ts
onKeyDown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelect();
    }
}}
```

A `<RovingList>` helper bakes this in.

### 4.4 Back Button

The browser's `popstate` fires on remote Back. We add:
```ts
useEffect(() => {
    const onPop = () => {
        if (directLinkOpen) setDirectLinkOpen(false);
        else if (showScoreModal) setShowScoreModal(false);
        else if (showHighScores) setShowHighScores(false);
        // ... other open dialogs/sheets
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
}, [directLinkOpen, showScoreModal, showHighScores]);
```

We push a history entry when opening a dialog so Back undoes it instead of
navigating away from the room.

### 4.5 Search Input on TV

Two paths:

- **Chromium with IME:** The `<Input>` element already accepts IME composition.
  The user navigates to it via D-pad, presses OK, the on-screen keyboard slides
  in. We just need to make sure the Input doesn't lose focus on tab switch.
- **No IME:** Some older WebOS / Tizen browsers don't show an on-screen
  keyboard. Fallback: a `<RovingList>` of "common queries" (top karaoke songs
  pre-baked: Bohemian Rhapsody, Wonderwall, etc.) so the user can search
  without typing. Out of scope for v1, flagged as future.

### 4.6 Hover-Only Affordances

Audit `app/room/[id]/page.tsx` for `hover:` Tailwind classes that hide content
on the non-hover state. Convert any **functional** hover-only controls (e.g.
"remove song" buttons hidden until hover) to either:
- Always visible (simpler, more clicks), or
- Revealed when the item has **roving focus** (e.g. `focus-within:` instead of
  `hover:`).

Decorative hover effects (color shifts) stay as-is.

### 4.7 Layout for 10-foot UI

- **Minimum 16px font size** at 1920×1080 (~5pt at 4K), or **24px recommended**.
- **Hit targets ≥ 48px × 48px** (Material guideline).
- **Reading distance 10 feet** means **larger thumbnails** (≥ 240px wide).
- **No horizontal scroll** in any list (queue, search results).
- **Two-column layout for queue:** thumbnail + title + button, never narrower.

A `<TVLayout>` wrapper applies media query overrides:
```css
@media (min-width: 1280px) and (pointer: coarse) {
    /* assume TV at this size with coarse pointer = no mouse */
    .tv-scale { font-size: 1.125rem; }
    .tv-hit { min-height: 48px; min-width: 48px; }
}
```

The `pointer: coarse` media query is the strongest signal we have for "no mouse
present", which is what differentiates TV from desktop.

### 4.8 Throttle Visibility

Current throttle silently drops requests. On TV, **silence is confusing** — the
user pressed OK and nothing happened. Add a visible cooldown countdown:

- When throttle blocks, show a 2-second toast: *"Slow down a sec…"*.
- Optionally, briefly disable the button with a `cooldown` state.

---

## 5. Design — Android TV APK Packaging

### 5.1 Approach: Trusted Web Activity (TWA)

Google's recommended path for installing a PWA on Android TV is **TWA**:

1. Host the OKtv Next.js build on HTTPS (Vercel, Cloudflare Pages, etc.).
2. Add a **PWA manifest** with `"display": "standalone"`, theme color, icons.
3. Add a **Service Worker** for offline shell + installability.
4. Use **Bubblewrap** (`npm i -g @bubblewrap/cli`) to generate the APK from the
   manifest.
5. Sign with a **debug key** for sideloading, or set up Play Console for store
   distribution.
6. Set `android.package` / `android.targetSdkVersion` to 34+ in bubblewrap config.
7. **Digital Asset Links**: host `/.well-known/assetlinks.json` on the web origin
   declaring the Android package + signing key. Without this, Chrome shows
   "open with browser" instead of fullscreen.

### 5.2 Leanback Manifest Requirements

For the APK to show up in the Google TV "Apps" row, the manifest must declare:

```xml
<uses-feature android:name="android.software.leanback" android:required="false" />
<intent-filter>
    <action android:name="android.intent.action.MAIN" />
    <category android:name="android.intent.category.LEANBACK_LAUNCHER" />
</intent-filter>
```

Bubblewrap doesn't add these by default — we customize the generated `AndroidManifest.xml`
post-generation. Alternatively, we fork a small Android project that wraps the
TWA WebView and adds the Leanback intent filter.

### 5.3 Recommended Architecture

```
oktv/
├── web/                 ← existing Next.js app
│   ├── public/manifest.webmanifest   (new)
│   ├── public/sw.js                  (new — service worker)
│   └── app/layout.tsx                (modified — link manifest)
└── android/             ← new Android Studio project (or Bubblewrap output)
    └── app/
        └── src/main/AndroidManifest.xml  (Leanback filter)
```

### 5.4 Test on a Real TV

The cheapest way to validate is **Android Studio's TV emulator** (a System Image
under SDK Manager → "Android TV"). Plus a Bluetooth remote via the emulator's
extended controls.

We should NOT consider this spec "complete" without a manual test pass on the
emulator:

- [ ] App appears in TV launcher row
- [ ] D-pad navigates between all interactive elements
- [ ] OK activates each element
- [ ] Back closes dialogs
- [ ] Search input opens on-screen keyboard
- [ ] Throttle cooldown is visible
- [ ] No element is unreachable

---

## 6. Files Touched

### 6.1 Web side
- **Modified:** `app/globals.css` — global focus ring styles, `pointer: coarse`
  media query overrides
- **Modified:** `app/room/[id]/page.tsx` — replace `hover:` with `focus-within:`,
  add back-button popstate handler, add throttle cooldown toast
- **New:** `components/ui/roving-list.tsx` — Roving tabindex list helper
- **New:** `public/manifest.webmanifest` — PWA manifest
- **New:** `public/sw.js` — minimal service worker (offline shell)
- **New:** `hooks/use-tv-shortcuts.ts` — global key bindings (Back, Esc, Media keys)

### 6.2 Android side (separate project)
- **New:** `android/` directory — Bubblewrap-generated Android Studio project
- **Modified:** `android/app/src/main/AndroidManifest.xml` — Leanback filter
- **New:** `android/app/src/main/assets/.well-known/assetlinks.json` — DAL declaration

### 6.3 Tooling
- **Modified:** `package.json` — add `bubblewrap` as dev dependency
- **Modified:** `README.md` — add "Building for Android TV" section

---

## 7. Acceptance Criteria

### Web navigation
- `AC-TV-1` Pressing Tab on a keyboard cycles focus through every interactive
  element with a visible focus ring.
- `AC-TV-2` D-pad Right/Left switches tabs (search / queue / mic).
- `AC-TV-3` D-pad Up/Down moves focus through search results and queue items
  with a visible focus ring.
- `AC-TV-4` Pressing OK on a focused search result adds the song to the queue.
- `AC-TV-5` Pressing Back on the remote closes the dialog if one is open.
- `AC-TV-6` No element is `hover:`-only — every interactive control is
  keyboard-reachable.
- `AC-TV-7` The throttle cooldown is visible (toast or button state) when a
  rapid second search is attempted.

### TV layout
- `AC-TV-8` At 1920×1080 with `pointer: coarse`, the search input and queue
  items have ≥ 48px hit targets.
- `AC-TV-9` No horizontal scroll appears in the queue or search results.
- `AC-TV-10` Body font size ≥ 16px (≥ 18px on `pointer: coarse`).

### Android TV APK
- `AC-TV-11` `pnpm build && npx bubblewrap build` produces a signed APK.
- `AC-TV-12` The APK installs on the Android TV emulator and appears in the
  launcher.
- `AC-TV-13` Launching the APK opens the room page fullscreen (no browser
  chrome).
- `AC-TV-14` The D-pad works end-to-end as in AC-TV-1 through AC-TV-7.
- `AC-TV-15` `assetlinks.json` is hosted at `/.well-known/assetlinks.json` and
  passes Google's Digital Asset Links validator.

---

## 8. Risks

- **TWA on older Android TV versions:** TWA requires Android 5.0+ but with
  fullscreen behavior on 5.0-6.0 requires an older Chrome flag. Most TVs are
  on 9+ now, so this is theoretical.
- **Service Worker + Firebase:** Firebase Realtime Database uses WebSockets;
  service worker must not intercept those. We register the SW with a narrow
  scope and skip `fetch` events for Firebase URLs.
- **Bubblewrap / Play Console signing:** Play Console requires a specific
  signing key setup. Sideloading is simpler. We document both paths.
- **Custom Leanback filter + TWA:** the Leanback launcher intent filter and
  TWA are slightly at odds. The TWA already declares the launcher; we just
  add the LEANBACK_LAUNCHER category so the row picker shows the app.
- **Performance on low-end TVs:** some Android TV boxes are 1GB RAM / 4-core ARM.
  We need to keep the JS bundle lean. Next.js production build should be
  fine, but the YouTube iframe is heavy — defer autoplay until user joins a
  room.

---

## 9. Out of Scope (Future Specs)

- Cast / Miracast receiver mode (host a room from a phone to TV)
- Voice commands via `android.intent.action.VOICE_COMMAND`
- tvOS Safari packaging
- Picture-in-picture for the queue when navigating to search
- Native Leanback activity that talks directly to Firebase (skipping the WebView)
