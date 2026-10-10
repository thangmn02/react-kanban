# Home navigation and original Focus Dock restoration

## Diagnosis and correction

The clarified three entries are **Music, Beat Grid and Focus** in Home's main
navigation. All three mounted `FloatingFocus` through `FeatureRoute`, differing
only in the initially selected internal tab. Their internal contents were not
identical, but presenting the entire timer/dock shell at every destination made
the entries appear redundant. No internal tab-content bug was reproduced.

| Entry | Destination | Before | Corrected behavior |
|---|---|---|---|
| Music | `/music` | Full dock, Music tab selected | Existing MusicTrack player and controls |
| Beat Grid | `/beat-grid` | Full dock, Beat tab selected | Existing MusicNowPlaying and MusicGrid |
| Focus | `/focus` | Full dock, Tasks tab selected | Existing HomeRoute focus planning/session view |

All three navigation entries remain. Feature routes reuse existing components,
preferences and the existing music controller. Original player/grid CSS is scoped
to the feature container inside the existing shadow root. There is no second
timer controller and no new visual system.

The empty browser island policy is restored: `FocusDock` defaults to hidden
without pinned tasks; `AppOverlays` retains the native-widget empty-dock exception.
The Vinyl/Orbit experiment is detached from `FloatingFocus`. Its source and
ignored captures remain preserved, without an entry in the normal UI. Original
internal tab visibility, state and DOM preservation remain intact.

## Focus Dock verification

Playwright MCP exercised the real Chrome Document Picture-in-Picture workflow:

- Pin an existing task, start through the existing focus launchpad, and select
  **Pop out timer**. The original dock opened in a 520×580 window.
- Start/Pause changed the timer from 24:10 to 24:09. Returning to the tab and
  popping out again retained 24:09 and the same timer DOM identity.
- Closing the popup returned the dock; dismissing it removed the dock. No
  duplicate floating window remained.
- Minimize hid the task details; restore showed them. Shutdown opened the
  existing ritual dialog; the dialog was dismissed without completing shutdown.
- Tasks, Music and Beat Grid showed their distinct original contents within the
  floating dock. Inactive panels were hidden; the timer stayed mounted.

Home's three navigation controls were clicked individually. Music rendered its
original glass player; Beat Grid rendered five rows and 40 cells. Each feature
route had zero floating dock shells, timer rings and Vinyl/Orbit widgets. The
final browser state had no compact island or floating popup.

## Tests and evidence

- Full JavaScript regression: **115 files / 838 tests passed**, 30.76 seconds.
- After the final feature-only CSS scoping adjustment: **61 focused tests** passed
  across route, FloatingFocus, FocusDock, tab, PiP and BeatPattern integration tests.
- Typecheck, scoped ESLint and production Vite build passed after that adjustment.
- Native Desktop GUI was not exercised; no native lifecycle claim is made.

Raw screenshots/logs remain ignored under `src-tauri/target/music-motion/`:
`restored-entry-music.png`, `restored-entry-beat-grid.png`,
`restored-entry-focus.png`, `restored-popup-tasks.png`,
`restored-popup-music.png`, `restored-popup-beat-grid.png`,
`restored-returned-dock.png`, `restoration-tests.log` and `restoration-build.log`.

## Scope and remaining issues

Changed behavior is confined to feature-route composition and restoration of
the prior dock mount policy. Regression tests cover the route distinction,
prototype exclusion, empty-island policy and original tab state. README documents
the navigation/pop-out workflow. Pre-existing capture-demand and private debug
changes in FloatingFocus, and accepted animation CSS changes, are preserved.

No audio detector, model, event scheduler, flash duration, analysis service or
deployment configuration was changed. Browser console errors were the existing
Beat analysis gateway 503 responses; Lead availability remains a separate issue.
No new UI runtime exception was observed. The existing theme-neutral injection
warning also remains. No deployment was performed.

This restoration is complete; the rejected visual exploration remains stopped.
