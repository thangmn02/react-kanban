# Repair installed Companion delivery

Outcome: users load the current public Companion without a source checkout.
Preserve Beat code and security policies; do not start later roadmap work.

Evidence: source, generated resources and the 0.1.15 NSIS file inventory contain
Companion 0.3.14. Installed executable is 0.1.14 and its extension is 0.3.13.
Windows Code Integrity events 3077/3033 at 22:56:58 explicitly rejected the
updater's 0.1.15 installer for publisher-signing policy. This is an incomplete
app update, not stale resources inside the new installer. Minisign updater
authentication does not provide Windows Authenticode publisher trust.

- [x] Back up installed Companion, then replace it from the HTTPS public ZIP.
- [x] Verify all deployed extension files and the installed manifest version.
- [x] Make standalone installed-folder update instructions discoverable online
      and in the offline guide; ensure downloads revalidate after publication.
- [ ] Run scoped verification, publish the guide and record the app-update limit.

Rollback: restore the saved Companion archive. No app data, browser profiles,
security policy, installed executable or registry changes are authorized by
this repair. A Windows-trusted signing identity remains necessary for an app
installer accepted by this PC's active policy.

The old folder is backed up at
`src-tauri/target/release/companion-before-repair-261006-2306.zip` (ignored).
All 35 repaired files match the actual public archive. User confirmed the
browser shows 0.3.14 after Reload. English/Vietnamese update instructions,
public download link, 390px layout and absence of page errors passed an Edge
browser check. Syntax, typecheck and production build passed. Initial browser
check import used an unavailable root `playwright` module; rerunning with the
repository's installed `@playwright/test` succeeded. No detector changes.
