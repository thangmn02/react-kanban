import { describe, expect, it, vi } from 'vitest';
import { boardToCsv, boardToIcs, handleShareFeed } from './shareFeed';

const token = 'A'.repeat(43);
const board = { board: { title: 'Launch, Q4' }, lists: ['To do', 'Done'], tasks: [
  { title: 'Ship "v2", then rest', list: 'Done', priority: 'High', dueDate: '2026-11-30', isDone: true, updatedAt: '2026-11-11T08:00:00Z', assignees: ['Linh', 'An'], description: 'SECRET' },
  { title: '=HYPERLINK("https://evil.test","click")', list: 'To do', priority: null, dueDate: null, isDone: false, updatedAt: null, assignees: [] },
  { title: 'Gửi báo giá; kiểm tra\nhợp đồng', list: 'To do', priority: 'Low', dueDate: '2026-12-31', isDone: false, updatedAt: null, assignees: [] },
] };
const config = (body: unknown = board, ok = true) => {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status: ok ? 200 : 500 }));
  return { supabaseUrl: 'https://db.test/', supabaseAnonKey: 'anon', fetch: fetchMock as unknown as typeof fetch, fetchMock };
};
const get = (query: string, options: Parameters<typeof handleShareFeed>[1] = config()) => handleShareFeed(new Request(`https://kora.test/api/share-feed?${query}`), options);

describe('share feed', () => {
  it('serves the board as CSV for Google Sheets, with formulas neutralised', async () => {
    const options = config(), response = await get(`format=csv&token=${token}`, options);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const lines = (await response.text()).split('\r\n');
    expect(lines[0]).toBe('Task,Status,Assignee,Priority,Due date,Done,Updated');
    expect(lines[1]).toBe('"Ship ""v2"", then rest",Done,Linh; An,High,2026-11-30 (Mon),yes,2026-11-11 (Wed)');
    expect(lines[2]).toBe('"\'=HYPERLINK(""https://evil.test"",""click"")",To do,,,,no,');
    expect(lines[3]).toBe('Gửi báo giá; kiểm tra hợp đồng,To do,,Low,2026-12-31 (Thu),no,');
    expect(lines.join('')).not.toContain('SECRET');
    expect(options.fetchMock).toHaveBeenCalledWith('https://db.test/rest/v1/rpc/get_shared_board', expect.objectContaining({ method: 'POST', body: JSON.stringify({ share_token: token }) }));
  });

  it('serves dated tasks as all-day events for Google Calendar', async () => {
    const response = await get(`format=ics&token=${token}`);
    expect(response.headers.get('Content-Type')).toBe('text/calendar; charset=utf-8');
    const ics = await response.text(), unfolded = ics.replace(/\r\n /g, '');
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(unfolded).toContain('X-WR-CALNAME:Launch\\, Q4');
    expect(unfolded.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(unfolded).toContain('DTSTART;VALUE=DATE:20261130\r\nDTEND;VALUE=DATE:20261201');
    expect(unfolded).toContain('DTSTART;VALUE=DATE:20261231\r\nDTEND;VALUE=DATE:20270101');
    expect(unfolded).toContain('SUMMARY:✓ Ship "v2"\\, then rest');
    expect(unfolded).toContain('SUMMARY:Gửi báo giá\\; kiểm tra\\nhợp đồng');
    expect(unfolded).not.toContain('SECRET');
    for (const line of ics.split('\r\n')) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
  });

  it('keeps event ids stable for a link, different between links, and unique for same-named tasks', () => {
    const shape = { title: 'B', lists: [], tasks: [1, 2].map(() => ({ title: 'Same', list: 'L', priority: null, dueDate: '2026-12-01', isDone: false, updatedAt: null, assignees: [] })) };
    const ids = (key: string) => [...boardToIcs(shape, key, new Date(0)).matchAll(/UID:(\S+)/g)].map(match => match[1]);
    expect(ids('k1')).toEqual(ids('k1'));
    expect(new Set(ids('k1')).size).toBe(2);
    expect(ids('k1')[0]).not.toBe(ids('k2')[0]);
    expect(ids('k1').join()).not.toContain('k1');
  });

  it('gives one answer for a malformed, unknown or switched-off link', async () => {
    const malformed = config(), bad = await get('format=csv&token=short', malformed);
    expect(bad.status).toBe(404);
    expect(malformed.fetchMock).not.toHaveBeenCalled();
    const unknown = await get(`format=csv&token=${token}`, config(null));
    expect(unknown.status).toBe(404);
    expect(await unknown.text()).toBe(await bad.text());
    expect(unknown.headers.get('Cache-Control')).toBe('no-store');
  });

  it('refuses other methods and formats, and reports an outage without detail', async () => {
    expect((await handleShareFeed(new Request(`https://kora.test/api/share-feed?format=csv&token=${token}`, { method: 'POST' }), config())).status).toBe(405);
    expect((await get(`format=json&token=${token}`)).status).toBe(400);
    expect((await get(`format=csv&token=${token}`, config(board, false))).status).toBe(502);
    expect((await get(`format=csv&token=${token}`, { supabaseUrl: '', supabaseAnonKey: '' })).status).toBe(503);
    const failing = { supabaseUrl: 'https://db.test', supabaseAnonKey: 'anon', fetch: (async () => { throw new Error('connection refused to 10.0.0.5'); }) as unknown as typeof fetch };
    const outage = await get(`format=ics&token=${token}`, failing);
    expect(outage.status).toBe(502);
    expect(await outage.text()).toBe('Temporarily unavailable');
  });

  it('writes an empty sheet and an empty calendar for a board with no tasks', () => {
    const empty = { title: 'Empty', lists: [], tasks: [] };
    expect(boardToCsv(empty)).toBe('Task,Status,Assignee,Priority,Due date,Done,Updated\r\n');
    expect(boardToIcs(empty, 'k')).not.toContain('VEVENT');
  });
});
