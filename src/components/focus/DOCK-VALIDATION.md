# Seamless dock and widget validation

2026-10-04: Five styles share one persistent focus panel, timer ring, session row, beat grid, and track panel. Framer Motion LayoutGroup/layoutId animates layout changes with a 350ms cubic-bezier(.22,1,.36,1) glide; Deck uses stiffness 300/damping 28 springs. Only the decorative scaffold crossfades (150ms exit, 350ms entrance). Reduced motion disables those transitions. Narrow Split and Deck stack vertically.

The three preferences live in a settings popover. The inline dock has a direct pop-out icon. The Document PiP hook uses one stable React portal target in a shadow host, moves it into the PiP document, and returns it to the opener on pagehide. Stylesheets are copied with readable-rule and cross-origin-link paths, plus the dock stylesheet. Closing or reopening PiP preserves the exact timer/grid DOM and layout state; denial keeps the in-tab dock usable. Closing the main app disposes the window and host.

Automated coverage checks element identity across all five styles, settings persistence/Escape, direct pop-out availability, stylesheet cloning, close/reopen continuity, denial recovery, shared callbacks, and cleanup. Changed-file lint and production build pass. All 385 assertions across 55 files pass, but both complete-suite attempts report the existing undici/WebSocket Event-realm error in HomeDashboard.test.tsx; those full runs exit nonzero.

Browser layout checks used a labeled synthetic, paused music session, not real audio. Split was checked at desktop and 520px, Tabs/settings and compact Deck were exercised, and temporary preview files were removed. The selected in-app browser reports Document PiP unavailable, so native PiP opening/closing is not live-verified in this pass. No new live music or browser-compatibility claim is made.

## Current native pass

The native surface is now Tauri; the earlier PiP record above describes the web
surface only. Layout switching uses the arrow button exclusively. The popover
retains color/palette and timer preferences, but no duplicate style picker.
Windows Acrylic applies only to Dock, with bright CSS glass and more opaque
settings; Tasks clears the effect. Native desktop appearance needs live acceptance.

The rendered synthetic check covers all five styles at 360/520/760px, direct
duration editing, three successive visible shape flashes with contrasting hit
colors, static row icons, and silence clearing. Unit coverage also verifies
confident tempo ticks reflash the held shape; clock-mode ticks cannot do so.
These fixtures are not evidence of live music capture.
