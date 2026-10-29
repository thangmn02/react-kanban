# External Windows Notes qualification — October 28, 2026

Kora now opens real Tauri note windows outside its main window. Actual Windows tests demonstrate editing, private images, Always on Top, click-through into Notepad, bubble recovery, restart and connected offline durability. Full Windows qualification remains partial because physical display/sleep, tray/shortcut and combined audio/performance workloads were not exercised.

## Independent decisions

| Gate | Result | Evidence boundary |
|---|---|---|
| In-app Quick Notes | PASS | Five final local workflow groups and real staging task continuity pass. |
| External floating notes | PARTIAL | Real native local/connected editing and images pass; the full hardware/workload matrix remains open. |
| Always on Top | PASS | The note stayed above an independently activated, task-owned Notepad window. |
| Click-through & recovery | PASS | A click at screen `(283,314)` inside the note bounds focused Notepad and accepted test text. The main controller restored interaction while minimized. A physical tray-menu click is separately unproven. |
| Durable persistence | PASS | Browser transactions, Windows encrypted journals, exact-ID restart and actual connected forced-interruption recovery pass within the acknowledged-save model. |
| Native lifecycle | PARTIAL | Clean quit, five-note restart and sign-out isolation pass; physical transitions and renderer-only failure remain open. |
| Windows native E2E | PARTIAL | The actual exercised scenarios pass; missing scenarios are not promoted to PASS. |
| P3 preservation | PASS | 88 protected checks and three model hashes pass. Physical audio synchronization was not requalified. |

## Architecture and permissions

The main WebView owns Auth, current workspace access, the shared Notes repositories and outboxes. Registered `note-*` windows contain the small editor and obtain scoped snapshots/media through the broker. Rust owns registered context, request nonces, DPAPI journals, placement, topmost/cursor flags and tray/global-shortcut integration. Opening another presentation retains the original note ID and revision contract.

`src/main.tsx` selects the minimal native-note entry before the main app. Note frames do not instantiate another Focus/audio owner. `src-tauri/capabilities/notes.json` allows the scoped Notes command and event listening; the main capability owns the controller commands. No broad filesystem or shell capability was added for note content. Actor-separated WebView data directories and Rust identity checks prevent one account from adopting another account's frame.

Opacity, Always on Top and expanded/bubble bounds belong to device placement. Collapse, hide and Trash are distinct. Ghost uses native cursor-event ignoring; Restore is independent of the ignored surface. The tray provides New Quick Note, Restore Notes, Notes Manager and Quit. Global capture is explicitly opt-in, conflict-aware and released on identity change/exit.

## Lifecycle and durability

Frames mark edits and acknowledge a prepare-close nonce after their local writes finish, including their initial durable read. They freeze during that handshake. Initial context also carries a pending nonce so a frame cannot miss a request sent before listener registration. Cancellation invalidates delayed context replies; replacing a frame writer invalidates the previous acknowledgment. The main owner then checks repository durability before sign-out, user workspace changes or quit. Failure cancels the freeze and retains recovery/export routes. A renderer that does not respond cannot silently authorize a forced quit.

The catalog retains opened/hidden/collapsed placement per actor and permitted scope. Restart revalidates connected originals before reopening them. Destroyed frames now release only their registry entries and pending requests, preventing stale close blockers; Restore also asks the main owner to revalidate the catalog. Intentional teardown removes entries before window destruction. Seven Rust tests and read-only review cover these invariants, including isolation of neighboring records, damaged-file retention and writer replacement. Concurrent frame construction is serialized separately from the registry mutex; OS window calls do not hold that registry mutex.

Actual connected testing used generated staging data. During a controlled REST/Storage transport outage, the external window reported local retention while the cloud row stayed unchanged. The encrypted outbox was read back before the exact owned process was force-stopped. After restart, recovery used the stored operation token, advanced exactly one server revision and retained the same original and private image. The recovered frame displayed **All changes saved.** Sign-out reduced managed windows to zero, followed by a clean quit.

## Actual Windows evidence

Artifacts are under `scratch/notes-completion-261027-1806/`:

| Artifact | Result |
|---|---|
| `native-ghost-notepad-261028.png` and matching JSON | Topmost note over an owned Notepad surface; real click-through and typed text. |
| `native-independent-recovery.json` | Actual manager Restore control completed through the owned WebView while main was minimized. This is not a physical tray click. |
| `native-bubble-recovery-261028.json` | Collapse to 64×64 and one-click return to 360×460 with original text. |
| `native-clean-quit-261028.json` | Five-frame guarded quit completed without forced termination. |
| `native-restart-recovery-261028.json` | Five exact note IDs and canonical text recovered after restart. |
| `native-focus-five-notes-261028.json` | The isolated Focus timer started and paused with five notes present. |
| `native-connected-final-261028-1852/native-image-offline.png` | A real private staging image and retained offline edit in an external native frame. |
| `native-connected-final-261028-1852/offline-durable-receipt.json` | Actual encrypted outbox read-back and unchanged cloud revision before interruption. |
| `native-connected-final-261028-1852/forced-interruption.json` | Exact owned PID, creation/parent checks and tested binary SHA-256 for the deliberate fault. |
| `native-connected-final-261028-1852/native-recovered-image.png` | Same recovered native original/image with confirmed cloud save state. |
| `native-connected-final-261028-1852/connected-native-recovered.json` | Same token, one new revision and one original; completed recovery was reconciled after a compact-preview harness assertion. |
| `native-connected-final-261028-1852/connected-native-signout.json` | Zero managed windows after sign-out. |
| `native-final-smoke.json` | Final embedded frontend: eight concurrent open requests reused one frame, Restore created no duplicate, and the first guarded quit exited the exact owned process. |

The owned Notepad document was saved and closed. Its two hidden launchers were removed after exact ownership checks. Qualification servers/browsers/native instances were closed; generated hosted accounts/assets were removed and read-only cleanup verification passed. The user's Docker stack was retained.

## Resource measurements

`native-resource-matrix-selected-261028.json` contains actual process samples from the isolated Windows debug runtime. The host has 16 logical CPUs and approximately 27.8 GiB RAM. Values sum only the Kora process and its descendants. Working sets include shared pages; private bytes provide a separate measure.

| Text-note windows | Whole-machine CPU sample | Private memory | Increase from baseline |
|---|---:|---:|---:|
| 0 | 0.37% | 504 MiB | — |
| 1 | 1.73% | 659 MiB | 154 MiB |
| 3 | 0.93% | 755 MiB | 250 MiB |
| 5 | 1.07% | 761 MiB | 257 MiB |

These are short debug samples taken before the final non-emitting editor permission fix. They establish a measured cost and do not establish a release performance budget. Five text windows need roughly 257 MiB of additional private memory on this host; a provisional investigation threshold is 350 MiB additional headroom and 2% whole-machine quiescent CPU on comparable hardware. These are diagnostic targets, not an enforced window cap. No arbitrary native window limit was introduced.

Longer production-build samples with images, bubbles, a running Focus session, authorized Companion capture and Beat Grid playback are still required for frame pacing, autosave traffic and supported-hardware budgets. The image and Focus smoke results are separate from the text-window resource matrix.

## Identity and remaining qualification

The [source/build manifest](../../scratch/notes-completion-261027-1806/final-source-build-manifest-261028-1852.json) records full identities and configuration. The connected interruption test used binary SHA-256 `224aa00281fd735a59fe21a033cdda1005b58ffec2bfd18b0de718bd1a20d103`. Subsequent reviewed registry/concurrency/startup-handshake repairs have separate Rust tests and the final embedded concurrency/Restore/first-quit smoke; the manifest distinguishes that final binary from the connected-test binary. Connected image/interruption evidence was not silently attributed to the later binary.

Physical secondary-monitor disconnect/reconnect, DPI/resolution changes, sleep/resume, a renderer-only crash, a physical tray action and a real shortcut-conflict exercise remain unproven. Combined image/audio/capture performance and 60/120 Hz pacing remain open. No installer was replaced or production endpoint deployed. These limits keep native lifecycle/Windows E2E and production release from receiving full approval.

October 29 follow-up: actual five-window isolation found global event fanout despite distinct registered originals. Both frontend listeners and Rust emissions now target the exact WebView label, and snapshots must match the frame's original ID. Final native evidence verifies five originals, one-note-only writes, independent flags and normal guarded quit. A later generated-control soak was incomplete when three frames were collapsed; they remained responsive, were restored and passed final isolation. This is not lost-content evidence or a completed endurance gate. Exact receipts and owner-listening separation are recorded in the latest final/P4 reports.
