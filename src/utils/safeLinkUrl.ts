/**
 * Task links come from any workspace member, so only web addresses become clickable.
 * javascript:, data:, file: and other schemes are rejected when saved and never rendered as a link.
 */
export function isSafeLinkUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value.trim());
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}
