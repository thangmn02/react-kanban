import { createHash } from 'node:crypto';
import { parseSharedBoard, type SharedBoard } from '../src/services/share-link-shape';

/**
 * One-way feeds for a read-only share link, so a board can be followed from Google without an account link:
 *   format=csv  -> Google Sheets, with =IMPORTDATA("<address>")
 *   format=ics  -> Google Calendar, with "Add calendar > From URL"
 * Both read through the same database function as the share page, so they show exactly what the page shows and
 * stop the moment the link is turned off. Nothing is written back, and no Google credentials are stored.
 */
export interface ShareFeedConfig { supabaseUrl?: string; supabaseAnonKey?: string; fetch?: typeof fetch }

const TOKEN = /^[A-Za-z0-9_-]{40,128}$/;
const text = (body: string, status: number, type = 'text/plain; charset=utf-8') => new Response(body, { status, headers: {
  'Content-Type': type, 'Cache-Control': status === 200 ? 'private, max-age=300' : 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'X-Content-Type-Options': 'nosniff' } });

/** A spreadsheet treats a cell starting with = + - @ as a formula. Task titles are other people's text, so those are neutralised. */
function cell(value: string | null | undefined) {
  let out = String(value ?? '').replace(/\r\n?|\n/g, ' ');
  if (/^[=+\-@\t]/.test(out)) out = `'${out}`;
  return /[",]/.test(out) ? `"${out.replace(/"/g, '""')}"` : out;
}

export function boardToCsv(board: SharedBoard) {
  const rows = [['Task', 'Status', 'Assignee', 'Priority', 'Due date', 'Done', 'Updated'],
    ...board.tasks.map(task => [task.title, task.list, task.assignees.join('; '), task.priority ?? '', task.dueDate ?? '', task.isDone ? 'yes' : 'no', (task.updatedAt ?? '').slice(0, 10)])];
  return rows.map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
}

const icsText = (value: string) => value.replace(/\\/g, '\\\\').replace(/\r\n?|\n/g, '\\n').replace(/[,;]/g, match => `\\${match}`);
/** Lines are folded at 75 bytes, never inside a multi-byte character. */
function fold(line: string) {
  const out: string[] = []; let current = '', size = 0;
  for (const char of line) {
    const bytes = Buffer.byteLength(char);
    if (size + bytes > (out.length ? 74 : 75)) { out.push(current); current = ''; size = 0; }
    current += char; size += bytes;
  }
  out.push(current);
  return out.join('\r\n ');
}
const compact = (day: string) => day.replace(/-/g, '');
function nextDay(day: string) { const date = new Date(`${day}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + 1); return date.toISOString().slice(0, 10); }

/** Tasks with a due date become all-day events. `linkKey` keeps event ids stable for one link without revealing it. */
export function boardToIcs(board: SharedBoard, linkKey: string, now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const seen = new Map<string, number>();
  const events = board.tasks.filter(task => /^\d{4}-\d{2}-\d{2}/.test(task.dueDate ?? '')).flatMap(task => {
    const day = task.dueDate!.slice(0, 10), base = `${task.list}|${task.title}`, count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    const uid = createHash('sha256').update(`${linkKey}|${base}|${count}`).digest('hex').slice(0, 32);
    return ['BEGIN:VEVENT', `UID:${uid}@kora-share`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${compact(day)}`, `DTEND;VALUE=DATE:${compact(nextDay(day))}`,
      `SUMMARY:${icsText(`${task.isDone ? '✓ ' : ''}${task.title}`)}`,
      `DESCRIPTION:${icsText([task.list, task.assignees.join(', '), task.priority].filter(Boolean).join(' · '))}`,
      'TRANSP:TRANSPARENT', `STATUS:${task.isDone ? 'CANCELLED' : 'CONFIRMED'}`, 'END:VEVENT'];
  });
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Kora//Shared board//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsText(board.title)}`, ...events, 'END:VCALENDAR'].map(fold).join('\r\n') + '\r\n';
}

export async function handleShareFeed(request: Request, config: ShareFeedConfig): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') return text('Method not allowed', 405);
  const url = new URL(request.url), token = url.searchParams.get('token') ?? '', format = url.searchParams.get('format');
  if (format !== 'csv' && format !== 'ics') return text('Unknown format', 400);
  // One answer for a malformed, unknown or switched-off link, so the address cannot be probed.
  if (!TOKEN.test(token)) return text('Not found', 404);
  if (!config.supabaseUrl || !config.supabaseAnonKey) return text('Sharing is not configured', 503);

  let board: SharedBoard | null;
  try {
    const response = await (config.fetch ?? fetch)(`${config.supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/get_shared_board`, {
      method: 'POST', headers: { apikey: config.supabaseAnonKey, Authorization: `Bearer ${config.supabaseAnonKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ share_token: token }), signal: AbortSignal.timeout(8000) });
    if (!response.ok) return text('Temporarily unavailable', 502);
    board = parseSharedBoard(await response.json());
  } catch { return text('Temporarily unavailable', 502); }
  if (!board) return text('Not found', 404);

  return format === 'csv' ? text(boardToCsv(board), 200, 'text/csv; charset=utf-8')
    : text(boardToIcs(board, createHash('sha256').update(token).digest('hex')), 200, 'text/calendar; charset=utf-8');
}
