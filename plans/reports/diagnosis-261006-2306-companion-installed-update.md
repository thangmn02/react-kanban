# Installed Companion update

The installer contains the current Companion. The installed copy stayed on
0.3.13 because the app itself remained on 0.1.14: Windows Code Integrity
3077/3033 explicitly blocked the 0.1.15 updater installer at 22:56:58 for its
publisher-signing policy. Updater Minisign verification does not supply a
Windows-trusted Authenticode publisher signature.

Repaired only Companion data from the real public 0.3.14 ZIP after backing up
the previous resource folder. All 35 files match that archive. The user
confirmed their browser displays 0.3.14 after Reload. Added public and offline
instructions for replacing the installed extension files without a repository
checkout, and revalidation headers for both public ZIP routes. This independently
updates the extension, not the application executable.

Edge verified English/Vietnamese instructions, the download link, narrow layout
and no page errors. Syntax, TypeScript and production build passed. No Beat
detector, scheduler, app data, executable, registry or security-policy changes.

Unresolved: full app updates on this PC require Windows-trusted publisher
signing. Closing app windows alone does not remove the policy block.
