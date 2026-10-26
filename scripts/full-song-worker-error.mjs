// Preserve a specific Python preparation failure instead of replacing it with
// a generic child exit code. A different process-launch error still takes priority.
export function preparationFailureMessage(state,code,launchError){
 return launchError||(state?.state==='BLOCKED'&&typeof state.error==='string'&&state.error.trim()?state.error:`Worker exited ${code}. Inspect preparation.log; retry retains successful caches.`);
}
