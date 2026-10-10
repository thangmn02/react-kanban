# Content-sized dock and media controls

The normal Web/Desktop dock now follows its active content. Removed the fixed
Web/native page hosts, full-height root and stretching final grid row. Width
containment retains compact controls without suppressing intrinsic height.

One bounded tab-content scroller contains Tasks, Music and Beat Grid. The
mini-player wrapper remains mounted with constant reserved space; its child is
hidden and inert on Music or idle playback. Removed layout projection from the
outer grid, which otherwise moved the tab bar by 6px during height transitions.
The tab position is now unchanged across eight sampled transition frames.

Glass styling is retained with stronger foreground tokens, an opaque active
pill, and bordered/shadowed inner cards. The blue-purple Music face is preserved.

Companion 0.3.15 uses the existing authenticated app relay and a document-bound
`chrome.tabs.sendMessage` command listener. It delegates to the existing guarded
HTML5 controller, including detached players, seekable-range checks and real
provider next/previous buttons. Existing clock synchronization remains intact.
No detector, musical timestamps, renderer or analysis configuration was changed.

Validation: 95 focused tests pass, including mini-player persistence, PiP,
UI command binding, actual media property manipulation, changed-source rejection
and provider button execution. Typecheck, focused lint and signed native/Web
builds pass. Playwright on the normal Focus route measured 390–416px versus
680px before; all tab tops remained exactly 333.29px. A separate real Chromium
session with Companion 0.3.15 verified YouTube play/pause, seek to 10s and volume
0.25 through the actual content-script messaging path; stale-source commands
were rejected. That owned browser was closed after validation. The existing
older Timing Test installation returned playback errors and requires updating.
No private test model assets are published.

Release: signed Kora 0.1.17; published deploy `6aca2611f81ab27363094000`
on 2026-10-10 at 11:51:19 UTC. Installer
SHA-256 `badb2a3792c33318c161c9a9db8a6cbc297d27643e6a35fc91573116ef078702`.
Updater signature and routing/API checks passed. Both production backend function
digests are preserved byte-for-byte. Raw evidence stays in ignored
`src-tauri/target/four-row-focus-parity`.

Automatic approval review rejected copying local authentication into the draft
origin. No credentials were transferred; authenticated visual validation used
the existing local session. Release verification used actual HTTPS assets.

Public promotion succeeded at https://koraspace.online. Live installer/update
feed signature and hash checks passed; Companion package version is 0.3.15.
