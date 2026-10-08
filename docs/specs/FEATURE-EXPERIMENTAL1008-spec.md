# Feature Experimental Labels — Specification

**Status:** Approved  
**Security priority:** Standard — this changes admin configuration and UI labels, but introduces no new sensitive data or authorization roles.  
**Complexity:** S  
**Data sensitivity:** Internal

## User story

As an administrator, I want to mark each feature as experimental independently of whether it is enabled, so users can see which enabled features are still experimental before creating or joining a room.

## Scope and behavior

- Add an independent Experimental toggle for Phone as Microphone, Karaoke Scorer, and Live Reactions in the existing admin Features page.
- Store the three experimental states alongside the existing enabled states at `config/flags`.
- Experimental states default to `false` when absent or invalid, preserving compatibility for existing installations.
- Keep the existing enabled-feature behavior unchanged.
- In the create-room modal, replace static BETA labels with an Experimental badge shown only when that feature's experimental state is on. Do not show the badge for a disabled feature, since disabled features are already hidden.
- In the room UI, show the same conditional badge on the corresponding feature surfaces: Phone Microphone, Karaoke Champions/scorer, and the floating Reactions control. The room UI reads the global experimental metadata; changing that metadata updates the badge without changing whether the room feature itself is enabled.
- Keep the existing tab layout. A tab redesign is out of scope unless implementation reveals a concrete layout/accessibility issue caused by these labels.

## API and compatibility

- Preserve admin authentication on `GET` and `PUT /api/admin/flags`.
- `GET` returns the three enabled booleans and three experimental booleans, with experimental values defaulted to `false` when older stored data lacks them.
- `PUT` continues to require all three enabled booleans. It accepts experimental booleans as optional fields so older clients remain compatible; omitted experimental values are preserved rather than reset. Supplied experimental values must be booleans. Unknown keys and invalid values are rejected.
- Writes update the existing flags record without discarding unrelated/previously stored metadata.

## Security considerations

- The endpoint remains admin-authenticated; no public write path is added.
- Validate the request shape and boolean types before persisting it.
- Feature labels are presentation metadata only and do not grant access or enable a feature.
- No personal or other sensitive data is introduced.

## Success criteria

- **AC-FEATURE-EXPERIMENTAL1008-F1:** An administrator can independently enable or disable the Experimental state for each of the three existing features without changing that feature's enabled state.
- **AC-FEATURE-EXPERIMENTAL1008-F2:** Experimental state is persisted and returned by the admin flags API; absent or invalid stored experimental values normalize to `false`.
- **AC-FEATURE-EXPERIMENTAL1008-F3:** A legacy-compatible flags update that omits experimental fields preserves stored experimental values; invalid experimental types and unknown keys are rejected.
- **AC-FEATURE-EXPERIMENTAL1008-F4:** The create-room modal shows Experimental instead of the static BETA label when the corresponding feature is enabled and marked experimental, and shows no badge otherwise.
- **AC-FEATURE-EXPERIMENTAL1008-F5:** The room UI conditionally labels the Phone Microphone, Karaoke Champions/scorer, and floating Reactions surfaces as Experimental based on global metadata, without changing feature availability.
- **AC-FEATURE-EXPERIMENTAL1008-F6:** Admin experimental controls are distinct, keyboard-accessible controls and do not rely on nested interactive elements.
- **AC-FEATURE-EXPERIMENTAL1008-S1:** Unauthenticated requests cannot read or modify admin feature flags, and malformed or unrecognized writes cannot alter persisted flags.

## Out of scope

- Redesigning the admin navigation/tabs.
- Changing feature enablement, room creation behavior, or runtime access based on experimental status.
- Per-room experimental overrides, release scheduling, analytics, or user-facing explanations beyond the badge.
- Removing or renaming the existing feature enable/disable controls.

## Verification approach

- Add unit tests for flag normalization and defaults, plus API tests for authorization, validation, and backward-compatible partial metadata updates where the current test setup supports route testing.
- Verify conditional badge rendering for the creation modal and each room feature surface.
- Run the project test suite, TypeScript check, lint if configured, and a production build when it can run without contending with the active development server.
- Manually verify the three independent toggles and badge visibility in the admin page, create-room modal, and room UI.
