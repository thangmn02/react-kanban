import type { SupabaseClient } from '@supabase/supabase-js';
import supabase, { requireSupabaseClient } from '../lib/supabase';
import { translateNow } from '../i18n/context';
import { isNativeWidget } from '../features/native/runtime';

/** Read-only share links exist only with a real backend; local demo mode has nobody to share with. */
export const shareLinksAvailable = () => Boolean(supabase);

export interface ShareLink { id: string; createdAt: string }
export interface SharedTask { title: string; list: string; priority: string | null; dueDate: string | null; isDone: boolean; updatedAt: string | null; assignees: string[] }
export interface SharedBoard { title: string; lists: string[]; tasks: SharedTask[] }

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

/** Creates a link and returns its URL. The token is shown once; only its hash is stored. */
export async function createShareLink(boardId: string, workspaceId: string) {
  const token = createShareToken();
  const { data, error } = await client().from('board_share_links')
    .insert({ board_id: boardId, workspace_id: workspaceId, token_hash: await hashShareToken(token) }).select('id,created_at').single();
  if (error || !data) throw new Error(translateNow('share.error.create'));
  return { link: { id: data.id as string, createdAt: data.created_at as string }, url: shareUrl(token) };
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

const text = (value: unknown) => typeof value === 'string' ? value : '';

/** Never trusts the shape of what comes back: this page is shown to people outside the workspace. */
export function parseSharedBoard(value: unknown): SharedBoard | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as { board?: { title?: unknown }; lists?: unknown; tasks?: unknown };
  if (!raw.board || typeof raw.board.title !== 'string') return null;
  const tasks = Array.isArray(raw.tasks) ? raw.tasks : [];
  return {
    title: raw.board.title,
    lists: Array.isArray(raw.lists) ? raw.lists.filter((item): item is string => typeof item === 'string') : [],
    tasks: tasks.filter(item => item && typeof item === 'object' && typeof (item as SharedTask).title === 'string').map(item => {
      const task = item as Record<string, unknown>;
      return { title: text(task.title), list: text(task.list), priority: text(task.priority) || null, dueDate: text(task.dueDate) || null,
        isDone: task.isDone === true, updatedAt: text(task.updatedAt) || null,
        assignees: Array.isArray(task.assignees) ? task.assignees.filter((name): name is string => typeof name === 'string' && name.length > 0) : [] };
    }),
  };
}

/** Resolves null when the link is unknown, revoked or malformed; the page shows one message for all three. */
export async function fetchSharedBoard(token: string): Promise<SharedBoard | null> {
  if (!supabase || !TOKEN.test(token)) return null;
  const { data, error } = await client().rpc('get_shared_board', { share_token: token });
  if (error) throw new Error(translateNow('share.error.load'));
  return parseSharedBoard(data);
}
