/** True when the current pathname is a design-lab (preview-only) route. */
export function isDesignLabRoute(pathname: string): boolean {
  return pathname.startsWith('/design-lab');
}

/**
 * Whether the design lab is allowed to mount at all. The lab is a preview-only
 * surface and must never ship as a reachable route in a normal production build.
 *
 * Allowed when:
 * - the build is a dev build (`import.meta.env.DEV`), OR
 * - it is explicitly opted in via `VITE_ENABLE_DESIGN_LAB === "true"`.
 *
 * When disabled, a visit to `/design-lab/*` falls through to the normal App,
 * which routes it to the existing NotFound surface — no design-lab code mounts.
 */
export function isDesignLabEnabled(): boolean {
  return import.meta.env.DEV || import.meta.env.VITE_ENABLE_DESIGN_LAB === 'true';
}

/** True only when the lab should actually render for the given path. */
export function shouldMountDesignLab(pathname: string): boolean {
  return isDesignLabEnabled() && isDesignLabRoute(pathname);
}
