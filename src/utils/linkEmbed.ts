/**
 * Turns a link to a document, design or whiteboard into the address its service offers for embedding, so it can
 * open beside a task. Returns null for anything else: those links open in a new tab as before.
 * Only services that publish an embed address are listed; a page is never framed against its wishes.
 */
export function embedUrlFor(link: string): string | null {
  let url: URL;
  try { url = new URL(link); } catch { return null; }
  if (url.protocol !== 'https:') return null;
  const host = url.hostname.replace(/^www\./, ''), path = url.pathname;

  if (host === 'docs.google.com') {
    const match = path.match(/^\/(document|spreadsheets|presentation)\/d\/([A-Za-z0-9_-]+)/);
    return match ? `https://docs.google.com/${match[1]}/d/${match[2]}/preview` : null;
  }
  if (host === 'figma.com') {
    return /^\/(file|design|proto|board|slides)\/[A-Za-z0-9]+/.test(path)
      ? `https://www.figma.com/embed?embed_host=kora&url=${encodeURIComponent(`https://www.figma.com${path}${url.search}`)}` : null;
  }
  if (host === 'miro.com') {
    const match = path.match(/^\/app\/board\/([A-Za-z0-9_=-]+)/);
    return match ? `https://miro.com/app/live-embed/${match[1]}/` : null;
  }
  return null;
}
