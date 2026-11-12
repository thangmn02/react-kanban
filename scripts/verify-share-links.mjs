// Real-backend check of read-only share links, against the local Supabase stack or the authorized staging project.
// Usage: node scripts/verify-share-links.mjs <env file from `supabase status -o env`> [feed origin]
// Never targets production. Leaves its test accounts and data in place for the browser check;
// run with --cleanup to remove everything it created.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

// Local: an env file from `supabase status -o env`, loopback only.
// Staging: `--staging --authorized-project=<ref> --backup=<fresh manifest> --history-receipt=<committed receipt> --output=scratch/<dir>`,
// admitted by the project's own qualification-target (authorized project, fresh restore-verified backup, matching history).
const staging = process.argv.includes('--staging');
let env;
if (staging) {
  const { qualificationTarget } = await import('./qualification-target.mjs');
  env = (await qualificationTarget('scratch/share-links-staging')).config;
} else {
  env = Object.fromEntries(readFileSync(process.argv[2], 'utf8').split(/\r?\n/).filter(Boolean).map(line => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1).replace(/^"|"$/g, '')]; }));
  const api = new URL(env.API_URL);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(api.hostname)) throw new Error('Without --staging this check only runs against a local Supabase stack.');
}
// The feed origin is a local dev server, or (staging only) an unpublished staging draft of the Kora site.
const feedOrigin = process.argv.find(arg => arg.startsWith('http://localhost:') || arg.startsWith('http://127.0.0.1:')
  || (staging && /^https:\/\/[a-f0-9]{24}--kanthangboard\.netlify\.app$/.test(arg)));
const stateFile = 'scratch/share-link-real/state.json';
mkdirSync('scratch/share-link-real', { recursive: true });
const admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = () => createClient(env.API_URL, env.ANON_KEY, { auth: { persistSession: false } });
const sha = value => createHash('sha256').update(value).digest('hex');
const newToken = () => randomBytes(32).toString('base64url');

if (process.argv.includes('--cleanup')) {
  if (!existsSync(stateFile)) { console.log('nothing to clean'); process.exit(0); }
  const state = JSON.parse(readFileSync(stateFile, 'utf8'));
  for (const id of state.workspaces) await admin.from('workspaces').delete().eq('id', id);
  for (const id of state.users) await admin.auth.admin.deleteUser(id);
  writeFileSync(stateFile, JSON.stringify({ cleaned: new Date().toISOString() }));
  console.log(`removed ${state.workspaces.length} workspaces and ${state.users.length} accounts`);
  process.exit(0);
}

// --paste-link: after a run, give the test owner one live link on a small clean board, so the two feed addresses
// can be pasted into a real Google Sheet and Calendar. It is removed with everything else by --cleanup.
if (process.argv.includes('--paste-link')) {
  if (!feedOrigin) throw new Error('Give the feed origin the addresses should use.');
  const state = JSON.parse(readFileSync(stateFile, 'utf8'));
  const client = anon();
  const signedIn = await client.auth.signInWithPassword({ email: state.ownerEmail, password: state.password });
  if (signedIn.error) throw new Error('The test owner could not sign in.');
  const need = (result, what) => { if (result.error) throw new Error(`${what}: ${result.error.message}`); return result.data; };
  const board = need(await admin.from('boards').insert({ title: 'Kora feed test', workspace_id: state.workspace }).select().single(), 'board');
  const lists = need(await admin.from('lists').insert([{ board_id: board.id, workspace_id: state.workspace, title: 'To do', position: 0 },
    { board_id: board.id, workspace_id: state.workspace, title: 'Done', position: 1000 }]).select(), 'lists');
  const day = offset => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);
  const row = (list, title, position, extra = {}) => ({ board_id: board.id, list_id: lists.find(item => item.title === list).id, workspace_id: state.workspace, title,
    description: null, priority: null, due_date: null, is_done: false, position, assignees: [], image: null, deleted_at: null, archived_at: null, ...extra });
  need(await admin.from('tasks').insert([row('To do', 'Draft the release note', 1000, { priority: 'High', due_date: day(2) }), row('To do', 'Review with the team', 2000, { priority: 'Medium', due_date: day(5) }),
    row('To do', 'No date yet', 3000), row('Done', 'Collect feedback', 1000, { priority: 'Low', due_date: day(-1), is_done: true })]), 'tasks');
  const value = newToken();
  need(await client.from('board_share_links').insert({ board_id: board.id, workspace_id: state.workspace, token_hash: sha(value) }).select('id').single(), 'link');
  const address = format => `${feedOrigin}/api/share-feed?format=${format}&token=${value}`;
  for (const format of ['csv', 'ics']) { const response = await fetch(address(format)); if (response.status !== 200) throw new Error(`${format} feed answered ${response.status}`); }
  console.log(JSON.stringify({ page: `${feedOrigin}/share/${value}`, sheetsFormula: `=IMPORTDATA("${address('csv')}")`, calendarUrl: address('ics') }, null, 2));
  process.exit(0);
}

let failed = 0;
const ok =(name, pass, detail = '') => { if (!pass) failed++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${!pass && detail ? '  -> ' + detail : ''}`); };
const must = (result, what) => { if (result.error) throw new Error(`${what}: ${result.error.message}`); return result.data; };

// ---- accounts and data (service role, as a seed script would)
const run = Date.now().toString(36), password = randomBytes(18).toString('base64url');
const makeUser = async name => must(await admin.auth.admin.createUser({ email: `share-e2e-${name}-${run}@example.test`, password, email_confirm: true, user_metadata: { full_name: `E2E ${name}` } }), `create ${name}`).user;
const owner = await makeUser('owner'), member = await makeUser('member'), other = await makeUser('other');
const signIn = async user => { const client = anon(); must(await client.auth.signInWithPassword({ email: user.email, password }), `sign in ${user.email}`); return client; };

const w1 = must(await admin.from('workspaces').insert({ name: `E2E Share ${run}`, owner_id: owner.id }).select().single(), 'workspace 1');
const w2 = must(await admin.from('workspaces').insert({ name: `E2E Other ${run}`, owner_id: other.id }).select().single(), 'workspace 2');
for (const [workspace_id, user_id, role] of [[w1.id, owner.id, 'owner'], [w1.id, member.id, 'member'], [w2.id, other.id, 'owner']])
  must(await admin.from('workspace_members').upsert({ workspace_id, user_id, role }, { onConflict: 'workspace_id,user_id' }), 'membership');
const b1 = must(await admin.from('boards').insert({ title: 'Launch plan', description: 'SECRET board description', workspace_id: w1.id }).select().single(), 'board 1');
const b2 = must(await admin.from('boards').insert({ title: 'Other workspace board', workspace_id: w2.id }).select().single(), 'board 2');
const lists = must(await admin.from('lists').insert([{ board_id: b1.id, workspace_id: w1.id, title: 'To do', position: 0 }, { board_id: b1.id, workspace_id: w1.id, title: 'Done', position: 1000 },
  { board_id: b1.id, workspace_id: w1.id, title: 'Hidden list', position: 2000, archived_at: new Date().toISOString() }]).select(), 'lists');
const [todo, done, hidden] = ['To do', 'Done', 'Hidden list'].map(title => lists.find(list => list.title === title));
const listB2 = must(await admin.from('lists').insert({ board_id: b2.id, workspace_id: w2.id, title: 'Theirs', position: 0 }).select().single(), 'list b2');
const in30 = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
const task = (list, board, workspace, title, extra = {}) => ({ board_id: board.id, list_id: list.id, workspace_id: workspace.id, title, description: null, priority: null, due_date: null,
  is_done: false, position: 1000, assignees: [], image: null, deleted_at: null, archived_at: null, ...extra });
must(await admin.from('tasks').insert([
  task(todo, b1, w1, 'Write the announcement', { description: 'SECRET description', priority: 'High', due_date: in30, assignees: [{ name: 'E2E owner', avatar: 'SECRET-avatar', userId: owner.id }], image: 'SECRET-image' }),
  task(done, b1, w1, '=HYPERLINK("https://evil.test","x")', { priority: 'Low', is_done: true }),
  task(todo, b1, w1, 'Deleted task', { position: 2000, deleted_at: new Date().toISOString() }),
  task(todo, b1, w1, 'Archived task', { position: 3000, archived_at: new Date().toISOString() }),
  task(hidden, b1, w1, 'Task in archived list'),
  task(listB2, b2, w2, 'Other workspace task'),
]), 'tasks');
writeFileSync(stateFile, JSON.stringify({ run, users: [owner.id, member.id, other.id], workspaces: [w1.id, w2.id], board: b1.id, workspace: w1.id,
  ownerEmail: owner.email, memberEmail: member.email, password }, null, 2));

const asOwner = await signIn(owner), asMember = await signIn(member), asOther = await signIn(other), visitor = anon();
const token = newToken();
const insert = (client, workspace_id, board_id, value, extra = {}) => client.from('board_share_links').insert({ board_id, workspace_id, token_hash: sha(value), ...extra }).select('id').single();
const rls = result => /row-level security/.test(result.error?.message ?? '');
const denied = result => /permission denied/.test(result.error?.message ?? '');
const open = async (client, value) => (await client.rpc('get_shared_board', { share_token: value }));

// ---- creation
let r = await insert(asOwner, w1.id, b1.id, token);
ok('owner creates a link through the API', !r.error && Boolean(r.data?.id), r.error?.message);
const linkId = r.data?.id;
r = await insert(asMember, w1.id, b1.id, newToken()); ok('plain member cannot create a link', rls(r), r.error?.message ?? 'no error');
r = await insert(asOther, w1.id, b1.id, newToken()); ok('another workspace\'s owner cannot create a link here', rls(r), r.error?.message ?? 'no error');
r = await insert(asOther, w2.id, b1.id, newToken()); ok('a board cannot be linked under a different workspace', rls(r), r.error?.message ?? 'no error');
r = await insert(asOwner, w1.id, b2.id, newToken()); ok('owner cannot link a board from a workspace they are not in', rls(r), r.error?.message ?? 'no error');
r = await insert(asOwner, w1.id, b1.id, newToken(), { created_by: member.id }); ok('a link cannot be attributed to someone else', rls(r), r.error?.message ?? 'no error');
r = await insert(visitor, w1.id, b1.id, newToken()); ok('signed-out visitor cannot create a link', denied(r) || rls(r), r.error?.message ?? 'no error');

// ---- reading the table
r = await visitor.from('board_share_links').select('id'); ok('signed-out visitor cannot read the links table', denied(r), r.error?.message ?? `rows: ${r.data?.length}`);
r = await asMember.from('board_share_links').select('id'); ok('plain member sees no links', !r.error && r.data.length === 0, r.error?.message ?? `rows: ${r.data?.length}`);
r = await asOther.from('board_share_links').select('id'); ok('another workspace\'s owner sees no links', !r.error && r.data.length === 0, r.error?.message ?? `rows: ${r.data?.length}`);
r = await asOwner.from('board_share_links').select('id,token_hash'); ok('owner sees their link, stored only as a hash', !r.error && r.data.length === 1 && r.data[0].token_hash === sha(token) && !JSON.stringify(r.data).includes(token));
r = await visitor.from('tasks').select('id'); ok('signed-out visitor still reads no tasks directly', (r.data?.length ?? 0) === 0, `rows: ${r.data?.length}`);
r = await visitor.from('boards').select('id'); ok('signed-out visitor still reads no boards directly', (r.data?.length ?? 0) === 0, `rows: ${r.data?.length}`);

// ---- the public view
r = await open(visitor, token);
const board = r.data, text = JSON.stringify(board);
ok('signed-out visitor opens the live link', !r.error && Boolean(board), r.error?.message);
ok('board title and live lists only', board?.board?.title === 'Launch plan' && JSON.stringify(board?.lists) === '["To do","Done"]', JSON.stringify(board?.lists));
ok('only live tasks in live lists', JSON.stringify(board?.tasks?.map(task => task.title)) === JSON.stringify(['Write the announcement', '=HYPERLINK("https://evil.test","x")']), JSON.stringify(board?.tasks?.map(task => task.title)));
ok('task fields are exactly the public ones', board?.tasks?.every(task => Object.keys(task).sort().join() === 'assignees,dueDate,isDone,list,priority,title,updatedAt'), Object.keys(board?.tasks?.[0] ?? {}).sort().join());
ok('assignee names only', JSON.stringify(board?.tasks?.[0]?.assignees) === '["E2E owner"]', JSON.stringify(board?.tasks?.[0]?.assignees));
ok('nothing private in the response', !/SECRET|Other workspace|Deleted|Archived|Hidden|[0-9a-f]{8}-[0-9a-f]{4}-/.test(text), text.slice(0, 160));
for (const [name, value] of [['unknown token', newToken()], ['short token', 'abc'], ['the stored hash', sha(token)], ['SQL-shaped token', `' or '1'='1`.padEnd(48, 'x')]]) {
  r = await open(visitor, value); ok(`${name} opens nothing`, !r.error && r.data === null, r.error?.message ?? JSON.stringify(r.data)?.slice(0, 80));
}
r = await open(asOther, token); ok('the link works the same for a signed-in outsider (it is the link that grants access)', !r.error && r.data?.board?.title === 'Launch plan');

// ---- feeds (through the app's own /api/share-feed, when a dev server address is given)
if (feedOrigin) {
  const feed = async (format, value) => { const response = await fetch(`${feedOrigin}/api/share-feed?format=${format}&token=${value}`); return { status: response.status, type: response.headers.get('content-type'), body: await response.text() }; };
  let f = await feed('csv', token);
  ok('CSV feed serves the board', f.status === 200 && /^text\/csv/.test(f.type) && f.body.startsWith('Task,Status,Assignee,Priority,Due date,Done,Updated\r\n'), `${f.status} ${f.type}`);
  ok('CSV has the two live tasks and no private text', f.body.trim().split('\r\n').length === 3 && !/SECRET|Other workspace|Deleted|Archived|Hidden/.test(f.body), f.body.slice(0, 200));
  ok('CSV neutralises a formula-shaped title', f.body.includes(`"'=HYPERLINK(""https://evil.test"",""x"")"`), f.body);
  ok('CSV row is right', f.body.includes(`Write the announcement,To do,E2E owner,High,${in30},no,`), f.body);
  f = await feed('ics', token);
  ok('ICS feed serves a calendar', f.status === 200 && /^text\/calendar/.test(f.type) && f.body.startsWith('BEGIN:VCALENDAR\r\n') && f.body.endsWith('END:VCALENDAR\r\n'), `${f.status} ${f.type}`);
  ok('ICS has one all-day event for the one dated task', (f.body.match(/BEGIN:VEVENT/g) ?? []).length === 1 && f.body.includes(`DTSTART;VALUE=DATE:${in30.replace(/-/g, '')}`) && f.body.includes('SUMMARY:Write the announcement'), f.body.slice(0, 300));
  ok('ICS has no private text', !/SECRET|Other workspace|Deleted|Archived|Hidden/.test(f.body));
  f = await feed('csv', newToken()); ok('feed for an unknown link is 404', f.status === 404, String(f.status));
  f = await feed('ics', 'short'); ok('feed for a malformed link is 404', f.status === 404, String(f.status));
  f = await feed('json', token); ok('unknown feed format is refused', f.status === 400, String(f.status));
} else console.log('SKIP  feeds (no dev server address given)');

// ---- revocation
r = await asOwner.from('board_share_links').update({ token_hash: sha(newToken()) }).eq('id', linkId); ok('a link\'s token cannot be changed', denied(r), r.error?.message ?? 'no error');
r = await asOwner.from('board_share_links').update({ board_id: b1.id }).eq('id', linkId); ok('a link cannot be re-pointed', denied(r), r.error?.message ?? 'no error');
r = await asMember.from('board_share_links').update({ revoked_at: new Date().toISOString() }).eq('id', linkId).select('id'); ok('plain member cannot turn a link off', !r.error && r.data.length === 0, r.error?.message ?? `rows: ${r.data?.length}`);
r = await asOther.from('board_share_links').update({ revoked_at: new Date().toISOString() }).eq('id', linkId).select('id'); ok('another workspace\'s owner cannot turn it off', !r.error && r.data.length === 0, r.error?.message ?? `rows: ${r.data?.length}`);
r = await open(visitor, token); ok('link still opens after the refused attempts', Boolean(r.data));
r = await asOwner.from('board_share_links').delete().eq('id', linkId); ok('links cannot be deleted through the API', denied(r), r.error?.message ?? 'no error');
r = await asOwner.from('board_share_links').update({ revoked_at: new Date().toISOString() }).eq('id', linkId).is('revoked_at', null).select('id'); ok('owner turns the link off', !r.error && r.data.length === 1, r.error?.message);
r = await open(visitor, token); ok('a link that is off opens nothing', !r.error && r.data === null, JSON.stringify(r.data)?.slice(0, 80));
if (feedOrigin) for (const format of ['csv', 'ics']) { const response = await fetch(`${feedOrigin}/api/share-feed?format=${format}&token=${token}`); ok(`${format} feed stops when the link is off`, response.status === 404, String(response.status)); }
r = await asOwner.from('board_share_links').update({ revoked_at: null }).eq('id', linkId).select('id'); ok('a link that is off cannot be switched back on', rls(r) || (!r.error && r.data.length === 0), r.error?.message ?? `rows: ${r.data?.length}`);
r = await open(visitor, token); ok('and it stays off', r.data === null);

// ---- existing data untouched
r = await admin.from('tasks').select('id', { count: 'exact', head: true }).eq('board_id', b1.id); ok('all six seeded tasks of the two boards are still there', r.count === 5, `board 1 rows: ${r.count}`);
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
