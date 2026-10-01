#!/usr/bin/env node
/**
 * Patch a Bubblewrap-generated AndroidManifest.xml to add Leanback launcher
 * intent filter so the app shows up in the Google TV / Android TV "Your apps"
 * row.
 *
 * Bubblewrap generates a single MAIN/LAUNCHER intent-filter. We add a
 * duplicate with `category.LEANBACK_LAUNCHER` so the launcher also surfaces
 * the app under the TV-style rows. We also declare the `android.software.
 * leanback` feature as `required="false"` so non-TV Android devices (phones,
 * tablets) can still install.
 *
 * Spec: specs/03-tv-remote-navigation.md §5.2
 *
 * Usage:
 *   npx bubblewrap build             # generates android/ project
 *   node scripts/patch-leanback.cjs  # patches android/app/src/main/AndroidManifest.xml
 */

const fs = require("fs");
const path = require("path");

const manifestPath = path.join(
    process.cwd(),
    "android-build",
    "app",
    "src",
    "main",
    "AndroidManifest.xml"
);

if (!fs.existsSync(manifestPath)) {
    console.error(
        `[patch-leanback] Manifest not found at ${manifestPath}.\n` +
            `Run \`bubblewrap build\` first to generate the android/ project.`
    );
    process.exit(1);
}

let xml = fs.readFileSync(manifestPath, "utf8");

if (xml.includes("LEANBACK_LAUNCHER")) {
    console.log("[patch-leanback] Already patched. Skipping.");
    process.exit(0);
}

// 1. Add the leanback uses-feature as required=false (just inside <manifest>).
if (!xml.includes("android.software.leanback")) {
    xml = xml.replace(
        /<manifest[^>]*>/,
        (m) =>
            `${m}\n    <uses-feature android:name="android.software.leanback" android:required="false" />`
    );
}

// 2. Add a second intent-filter with LEANBACK_LAUNCHER on the main activity.
//    Bubblewrap uses both `LauncherActivity` (short name) and the fully-qualified
//    `com.google.androidbrowserhelper.trusted.LauncherActivity` depending on the
//    version. Match either.
const altFilter = `
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
                <category android:name="android.intent.category.LEANBACK_LAUNCHER" />
            </intent-filter>
`;

xml = xml.replace(
    /(<activity\s+android:name="(?:com\.google\.androidbrowserhelper\.trusted\.)?LauncherActivity"[^>]*>)([\s\S]*?)(<\/activity>)/,
);

fs.writeFileSync(manifestPath, xml);
console.log(`[patch-leanback] Patched ${manifestPath}`);
