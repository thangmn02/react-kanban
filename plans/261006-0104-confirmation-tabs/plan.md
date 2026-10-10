---
status: publishing
---

# Confirmation redirect and default Tabs dock

The instrumental-note update has shipped. The user now requested completing
these two queued tasks, plus a small release version in Contact.

Outcome: confirmation emails return users to the public Kora website rather
than localhost. Preserve successful registration and existing accounts.
Inspect the hosted Supabase Site URL and redirect allowlist before changing
them; preserve unrelated settings and back up the changed configuration.
The local Supabase development configuration remains local.

The glass Tabs dock becomes the only layout on web and Windows, including
users with a previously saved layout. Keep its persistent timer and task,
music and beat panels. Restore the circular timer with Start, Reset and
Complete & next. Hide visible scrollbars without making overflowed controls
unreachable. The full empty header area initiates native dragging; buttons,
inputs and the settings popover continue to work normally.

The user additionally requested restoring the old frosted glass appearance:
let the real background show through the translucent face, with soft blur and
bright beveled edges. Preserve native compositor glass and readable controls.

Non-goals: registration changes, data migrations, redesigning music controls,
changing the accepted AI note detection implementation, or publishing without
release authorization. AI work remains tracked in
[its active plan](../261005-2350-main-instrument/plan.md).

Diagnosis: signup omits emailRedirectTo. The screenshot shows localhost after
Supabase verifies the email; the hosted Site URL must be checked. Local
supabase/config.toml intentionally uses localhost and is not hosted authority.
Tabs CSS hides the timer SVG and forces overflow-y:auto. Other layouts remain
selectable and persistent. Only the small label calls native startDragging.

1. Implement and test explicit public confirmation redirects; inspect and fix
   the hosted auth configuration with a backup of affected fields.
2. Remove other layouts, restore the ring, hide scrollbars and widen dragging.
3. Show the release version in Contact from native release metadata, then
   verify behavior, responsive layout, regression suite and updated builds.
4. Finish shared documentation and package the combined release for approval.

Acceptance: signup passes the public /home confirmation destination; native
origins do not enter email links; hosted default/allowlist agree. Saved layouts
cannot override Tabs. All three tabs and timer actions remain usable. Native
header whitespace drags but controls do not. Beat grid fits the available pane;
overflow remains usable without visible scrollbar chrome.

## Delivery state

- Steps 1–4 are implemented, reviewed and packaged as signed Kora 0.1.13.
- Hosted Supabase Site URL and redirect allowlist are already corrected. The
  affected settings and previous installer/feed have private ignored backups.
- All 551 tests in 76 files passed; lint has zero errors and 23 existing
  warnings. Typecheck, production builds and the bundle budget passed.
- Final glass tuning passed browser layout checks at 520×680 and 360×540;
  the final native installer and website were rebuilt and verified afterward.
- Contact shows the native release version. Companion remains 0.3.12.
- The user authorized publication of 0.1.13. Commits 3902658, 0ff3cfd and
  329e722 were pushed together to main. Live deployment and CI verification
  are in progress.

Evidence and verification limits: [release review](../reports/review-261006-confirmation-tabs.md).
