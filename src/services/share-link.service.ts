import type { SupabaseClient } from '@supabase/supabase-js';
import supabase, { requireSupabaseClient } from '../lib/supabase';
import { translateNow } from '../i18n/context';
import { isNativeWidget } from '../features/native/runtime';
import { parseSharedBoard, type SharedBoard } from './share-link-shape';

export { parseSharedBoard };
export type { SharedBoard, SharedTask } from './share-link-shape';

/** Read-only share links exist only with a real backend; local demo mode has nobody to share with. */
export const shareLinksAvailable = () => Boolean(supabase);

export interface ShareLink { id: string; createdAt: string }

// The table and function are newer than the generated database types.
const client = () => requireSupabaseClient() as unknown as SupabaseClient;
const TOKEN = /^[A-Za-z0-9_-]{40,128}$/;

export function createShareToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function hashShareToken(token: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

// The desktop app has no public address of its own, so its links point at the website.
export const shareUrl = (token: string, origin = isNativeWidget() ? 'https://koraspace.online' : window.location.origin) => `${origin}/share/${token}`;

/** The same link as a feed Google can follow: `csv` for Sheets (IMPORTDATA), `ics` for Calendar (add by URL). */
export const shareFeedUrl = (token: string, format: 'csv' | 'ics', origin = isNativeWidget() ? 'https://koraspace.online' : window.location.origin) =>
  `${origin}/api/share-feed?format=${format}&token=${token}`;

/** Creates a link and returns its URL. The token is shown once; only its hash is stored. */
export async function createShareLink(boardId: string, workspaceId: string) {
  const token = createShareToken();
  const { data, error } = await client().from('board_share_links')
    .insert({ board_id: boardId, workspace_id: workspaceId, token_hash: await hashShareToken(token) }).select('id,created_at').single();
  if (error || !data) throw new Error(translateNow('share.error.create'));
  return { link: { id: data.id as string, createdAt: data.created_at as string }, url: shareUrl(token),
    sheetsFormula: `=IMPORTDATA("${shareFeedUrl(token, 'csv')}")`, calendarUrl: shareFeedUrl(token, 'ics') };
}

export async function listShareLinks(boardId: string): Promise<ShareLink[]> {
  const { data, error } = await client().from('board_share_links').select('id,created_at').eq('board_id', boardId).is('revoked_at', null).order('created_at', { ascending: false });
  if (error) throw new Error(translateNow('share.error.load'));
  return (data ?? []).map(row => ({ id: row.id as string, createdAt: row.created_at as string }));
}

export async function revokeShareLink(id: string) {
  const { data, error } = await client().from('board_share_links').update({ revoked_at: new Date().toISOString() }).eq('id', id).is('revoked_at', null).select('id');
  // No row back means nothing was revoked (no permission, or already gone); say so rather than report success.
  if (error || !data?.length) throw new Error(translateNow('share.error.revoke'));
}

/** Resolves null when the link is unknown, revoked or malformed; the page shows one message for all three. */
export async function fetchSharedBoard(token: string): Promise<SharedBoard | null> {
  if (!supabase || !TOKEN.test(token)) return null;
  const { data, error } = await client().rpc('get_shared_board', { share_token: token });
  if (error) throw new Error(translateNow('share.error.load'));
  return parseSharedBoard(data);
}
