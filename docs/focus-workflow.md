# Focus entry and window handoff

Focus is the single primary navigation entry for Tasks, Music and Beat Grid.
Opening `/focus` shows the existing dock in the application page, including an
empty task list. Internal tabs share the same Focus session and music controller.
The selected tab is recorded in the route query so refreshing preserves it.
Minimize/restore retains the dock DOM; Shutdown opens the existing ritual dialog.
The compact Home island remains task-gated and is not opened by unrelated actions.

Old `/music` and `/beat-grid` links redirect to `/focus?tab=music` and
`/focus?tab=beat`, preserving other query parameters and the hash. Authentication
still preserves intended protected destinations. Development links with
`musicDebug=1` remain at their intended diagnostic routes; normal Focus navigation
does not add that flag or expose saved-fixture controls.

On browsers supporting Document Picture-in-Picture, **Pop out dock** moves the
existing dock host into one 520×580 window. Tasks, Music and Beat Grid use that
same window; they do not open simultaneous PiP windows. Returning or closing it
puts the same host back in the Focus page. If the user left Focus while it was
floating, it returns to the established floating in-tab position. Dismissing the
in-page dock returns Home. Task-free pop-out is allowed from the explicit Focus
page; an incidental task-free timer caller still cannot open it. Unsupported
browsers keep the in-page dock and disable pop-out.

Tauri uses the existing single native window and controller. Its Dock action
switches the workspace to the compact, always-on-top surface; returning restores
the workspace. It does not simulate Chrome PiP or create a second native window.
The selected internal tab and Pomodoro state remain shared. Native window
minimize, maximize/restore and close remain the existing controls. Source clocks
and capture infrastructure are unchanged; sequential native view remounts retain
the existing native subscription lifecycle.

The normal Web and Desktop Beat Grid currently shows four rows of eight cells:
Kick, Snare / Clap, Hi-hat / Cymbal and Bass / Low pulse. Lead is temporarily
hidden, including its ordinary readiness strip. Private saved Lead diagnostics
retain their fifth row behind development gates. Both presentations use the same
renderer and explicit row count for masks, colors and layout. The frozen Lead
pipeline, backend admission and provider-audio restrictions are
described in [server Beat analysis](server-beat-analysis.md). Navigation/window
availability is not evidence that uncached provider Lead processing is ready.

Changing tabs or document visibility updates analysis demand without replacing
the music capture subscription. Source changes and shutdown still release that
subscription. Native captured audio is admitted only while analysis needs it;
hidden-state input and the preceding PCM context are discarded before resuming.
