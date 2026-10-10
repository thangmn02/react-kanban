# Kora signed updates and safe shipping

Status: shipped; awaiting user-side update and visual acceptance. Commit and push
were explicitly authorized by the user.

## Outcome and boundaries

Ship the current task/data, music, rounded-glass dock and download improvements.
Provide a native Update control that checks the existing HTTPS web host, validates
signed installers and installs only on explicit confirmation. Keep the app identity
and user data unchanged. No automatic installation, hosted SQL changes, microphone
capture, system-wide audio collection, or new release service.

## Acceptance

- [x] Native update check, confirmation, progress and retry; web stays unchanged.
- [x] Signed installer and valid static feed served together by the web host.
- [x] Private signing key and dotenv files excluded; staged source/artifacts scanned.
- [x] Tests, typecheck, lint, Rust checks and connected installer build pass.
- [x] Summarize diff, commit focused changes and push without force.
- [x] Remove obsolete review patches only after their code is recoverable in Git.

Existing installed builds require one manual bootstrap installation. Subsequent
updates use the same protected signing key. Desktop live visual/data acceptance
and a real newer-version installation cannot be claimed from unit tests alone.

## Current evidence

- The user accepted compositor corner clipping; GDI cut-outs left opaque blocks.
- The new frame subclass suppresses only native paint/activation messages and
  forwards resize, DPI, hit testing and close handling.
- A fresh isolated 0.1.6 window verified compositor rounding across 360/760/520px,
  client-area blur and production CSS. The reference now guides a neutral milky
  face with a bright rim and inset bevel, not a purple or heavily tinted backdrop.
- All five layouts pass synthetic resizing, duration editing and shape-reflash
  checks; these are not evidence of live music. The glow cannot intercept clicks.
- 460 frontend tests and eight Rust tests pass; lint has zero errors and 23
  existing warnings. Connected builds and the bundle budget pass.
- The final 0.1.6 signed installer is packaged. Signature verification passes
  and a one-byte alteration is rejected. Candidate-source and built-JS scans
  find no private environment values, signing keys or non-public JWTs.
- The obsolete diagnostic script was removed; its isolated process was closed.
- The public Netlify update feed returns JSON v0.1.6. Its signature matches the
  final signed package and the served installer SHA-256 matches local bytes.
  No live database migration or unsigned release publication was performed.
- Focused commits 96326d1 and 392def8 were pushed without force after diff review
  and staged-secret scans. Both CI and Windows widget runs passed.
- The owned preview server was stopped; no isolated native test remains open.

## Contrast and dragging follow-up

- The user's recording shows the legacy accent blur becoming clear during a
  native move, then returning to a dark tint after release. The installed app
  is 0.1.6; this fix therefore requires a new update version, not replaced bytes.
- 0.1.7 replaces accent blur with a light DWM compositor backdrop. A freshly
  compiled isolated native window, using the production Rust command and CSS,
  remained frosted during real pointer-driven dragging. Its sampled interior
  lightness stayed around 230–232/255 before, during and after movement. Native
  rounding and frame suppression remained intact. This is a compositor check,
  not evidence of a live music session or user acceptance of every background.
- Seven focused native-surface tests, 460 frontend tests and nine Rust tests
  pass. Lint has zero errors and 23 existing warnings. Connected native and web
  builds pass, including the bundle budget. The signed 0.1.7 installer verifies;
  a one-byte alteration is rejected.
- Temporary drag diagnostics were removed. The isolated process (35476) was
  closed; the user's installed Kora process was left running. No security or
  capture settings were changed.
- Review found no blocking issues. Candidate and staged scans exclude private
  dotenv values, signing material and non-public JWTs. Commit de58131 was pushed
  without force. The live Netlify JSON feed is v0.1.7; its signature and served
  installer SHA-256 match the signed local package. CI 37215793927 and Windows
  widget 37215793921 both passed. User-side update and final visual acceptance
  remain a live check; no silent installer launch was performed.
