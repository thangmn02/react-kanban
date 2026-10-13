# Spotify timeline and audio handoff

Status: implemented, reviewed, published and byte-verified; installed listening
acceptance pending.
Baseline: main at fcc6a4c.

## Outcome and boundaries

Show the actual song position/duration after YouTube → Spotify, including pause,
close, next track, and browser changes. Desktop must acquire its existing Windows
process audio automatically, keep the original browser playback path intact, and
deliver the current learned drum model without requiring each tab's toolbar click.
Reduce verified analysis hot-path work without changing trained features, model,
thresholds, four rows, or Bass behavior. Preserve Web tab-capture consent.

The user confirms audible stutter and grid freezes across Chrome, Brave and Edge.
Their underrun/main-thread/GC explanation is a hypothesis; the screenshot proves
Spotify 0:17 / 2:45 versus Kora 0:04 / 0:07. Visible-browser connection currently
fails before selection; isolated real browser/model tests supplement regressions.
Publication for installed listening tests was already authorized.

## Execution and acceptance

1. Reproduce decorative-video discovery, old-clock retention and Desktop routing.
   Observe Spotify's real transport/timeline when its audio is outside HTML media;
   reject decorative muted loops. Keep control/source and stale-watch guards.
2. Restore Desktop process PCM with the now-packaged learned runtime. Prove actual
   native-engine PCM inference, ownership and handoff; Web consent stays intact.
3. Measure FFT render-thread cost, remove redundant trig work with equivalent
   features, and check startup/render responsiveness under real PCM inference.
4. Run focused then shared checks, review public/cross-module changes, build and
   publish matching signed Desktop/Companion artifacts. Report measured results
   and leave human listening acceptance explicit.

Acceptance: a 7-second Canvas cannot replace the 165-second song clock; changing
track cannot retain the previous clock; late stop/start cannot retire the new
owner; Desktop never requests browser tab capture; production native PCM produces
learned drum events; FFT features/timestamps remain equivalent. Verify public
installer/archive/version parity. No user profile or installed payload edits.

Rollback: revert only this release's changes; retain the previous signed release
and Companion update backups. Stop owned test processes before finishing.

Execution evidence: [validation report](../reports/validation-261014-0518-spotify-timeline-and-audio-handoff.md).
