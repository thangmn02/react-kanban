import { MAX_STEP_LENGTH, normalizeBreakdownContext, parseTaskSteps, type TaskBreakdownContext } from '../src/features/today/utils/taskBreakdown';
import { TASK_BREAKDOWN_PROMPT } from './taskBreakdownPrompt';

export interface BreakdownConfig {
  apiKey?: string;
  model?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  // Only the Vite development adapter may enable this. Never enabled in Netlify.
  allowLocalMock?: boolean;
}

class RequestError extends Error {
  status: number;
  constructor(code: string, status: number) { super(code); this.status = status; }
}

const requests = new Map<string, { count: number; until: number }>();
function limitRequests(identity: string) {
  const now = Date.now();
  for (const [key, entry] of requests) if (entry.until <= now) requests.delete(key);
  const entry = requests.get(identity) ?? { count: 0, until: now + 60_000 };
  if (entry.count >= 5 || (!requests.has(identity) && requests.size >= 1000)) throw new RequestError('rate_limited', 429);
  requests.set(identity, { ...entry, count: entry.count + 1 });
}

function reply(value: object, status = 200) {
  return Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const reader = request.body?.getReader();
  if (!reader) throw new RequestError('invalid_request', 400);
  let size = 0;
  let body = '';
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 16_384) { await reader.cancel(); throw new RequestError('invalid_request', 413); }
    body += decoder.decode(value, { stream: true });
  }
  try {
    const parsed = JSON.parse(body + decoder.decode());
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    return parsed;
  } catch { throw new RequestError('invalid_request', 400); }
}

function isLoopback(url: URL) {
  return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
}

async function handleTaskBreakdownRequest(request: Request, config: BreakdownConfig): Promise<Response> {
  if (request.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405);
  if (!request.headers.get('content-type')?.includes('application/json')) return reply({ error: 'invalid_request' }, 415);
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(25_000)]);
  try {
    const body = await readBody(request);
    if (body.language !== 'en' && body.language !== 'vi') throw new RequestError('invalid_request', 400);
    if ((body.taskId !== undefined && (typeof body.taskId !== 'string' || !body.taskId || body.taskId.length > 100))
      || typeof body.workspaceId !== 'string' || !body.workspaceId || body.workspaceId.length > 100) throw new RequestError('invalid_request', 400);
    let context: TaskBreakdownContext;
    const url = new URL(request.url);
    const origin = request.headers.get('origin');
    if (config.allowLocalMock && isLoopback(url) && (!origin || origin === url.origin)) {
      limitRequests('local-demo');
      context = normalizeBreakdownContext(body.localContext ?? body.draftContext);
      if (!context.title) throw new RequestError('invalid_request', 400);
    } else {
      const token = request.headers.get('authorization');
      if (!token?.startsWith('Bearer ')) throw new RequestError('unauthorized', 401);
      if (!config.supabaseUrl || !config.supabaseAnonKey) throw new RequestError('not_configured', 503);
      const base = config.supabaseUrl.replace(/\/$/, '');
      const headers = { apikey: config.supabaseAnonKey, Authorization: token };
      const userResponse = await fetch(`${base}/auth/v1/user`, { headers, signal });
      if (!userResponse.ok) throw new RequestError('unauthorized', 401);
      const user = await userResponse.json() as { id?: unknown } | null;
      if (!user || typeof user.id !== 'string') throw new RequestError('unauthorized', 401);
      limitRequests(user.id);
      if (!body.taskId) {
        const workspaceQuery = new URLSearchParams({ select: 'id', id: `eq.${body.workspaceId}`, limit: '1' });
        const workspaceResponse = await fetch(`${base}/rest/v1/workspaces?${workspaceQuery}`, { headers, signal });
        if (!workspaceResponse.ok) throw new RequestError('task_unavailable', 403);
        const workspaces = await workspaceResponse.json();
        if (!Array.isArray(workspaces) || workspaces.length !== 1) throw new RequestError('task_unavailable', 403);
        context = normalizeBreakdownContext(body.draftContext);
        if (!context.title) throw new RequestError('invalid_request', 400);
      } else {
      // Read through the user's token: Supabase RLS is the authorization boundary.
      const taskQuery = new URLSearchParams({ select: 'title,description,is_done,due_date,board:boards(title),column:lists(title),label_links:task_label_links(label:task_labels(name))', id: `eq.${body.taskId}`, workspace_id: `eq.${body.workspaceId}`, archived_at: 'is.null', deleted_at: 'is.null', limit: '1', 'label_links.limit': '10' });
      const taskResponse = await fetch(`${base}/rest/v1/tasks?${taskQuery}`, { headers, signal });
      if (!taskResponse.ok) throw new RequestError('unavailable', 503);
      const rows = await taskResponse.json();
      const task = Array.isArray(rows) ? rows[0] : null;
      if (!task || task.is_done) throw new RequestError('task_unavailable', 404);
      const checklistQuery = new URLSearchParams({ select: 'content', task_id: `eq.${body.taskId}`, workspace_id: `eq.${body.workspaceId}`, order: 'position.asc', limit: '30' });
      const checklistResponse = await fetch(`${base}/rest/v1/task_checklist_items?${checklistQuery}`, { headers, signal });
      if (!checklistResponse.ok) throw new RequestError('unavailable', 503);
      const checklist = await checklistResponse.json();
      context = normalizeBreakdownContext({
        title: task.title, description: task.description, dueDate: task.due_date,
        boardTitle: task.board?.title, columnTitle: task.column?.title,
        labels: Array.isArray(task.label_links) ? task.label_links.map((link: { label?: { name?: unknown } }) => link.label?.name) : [],
        existingSteps: Array.isArray(checklist) ? checklist.map((item) => item.content) : [],
      });
      }
    }
    if (!config.apiKey) throw new RequestError('not_configured', 503);
    const model = config.model || 'gemini-2.5-flash';
    if (!/^[a-zA-Z0-9.-]+$/.test(model)) throw new RequestError('not_configured', 503);
    const generated = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.apiKey }, signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: TASK_BREAKDOWN_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: JSON.stringify({ userData: context, uiLanguage: body.language }) }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 2048, ...(model.startsWith('gemini-2.5-flash') ? { thinkingConfig: { thinkingBudget: 0 } } : {}), responseMimeType: 'application/json', responseJsonSchema: { type: 'object', additionalProperties: false, properties: { steps: { type: 'array', minItems: 3, maxItems: 3, items: { type: 'string', maxLength: MAX_STEP_LENGTH } } }, required: ['steps'] } },
      }),
    });
    if (!generated.ok) {
      // Keep credentials and user content out of logs. Google's error response is
      // useful for diagnosing an invalid model, key, quota, or malformed request.
      const googleErrorBody = await generated.text();
      console.error('[Gemini API error]', {
        status: generated.status,
        model,
        body: googleErrorBody.slice(0, 2_000),
      });

      if (generated.status === 429) throw new RequestError('rate_limited', 429);
      if (generated.status === 401 || generated.status === 403) {
        throw new RequestError('gemini_auth_failed', 502);
      }
      if (generated.status === 404) {
        throw new RequestError('gemini_model_not_found', 502);
      }
      if (generated.status >= 500) {
        throw new RequestError('gemini_unavailable', 503);
      }
      throw new RequestError('gemini_request_failed', 502);
    }
    const result = await generated.json() as { candidates?: { finishReason?: string; content?: { parts?: { thought?: boolean; text?: string }[] } }[] };
    const candidate = result.candidates?.[0];
    if (candidate?.finishReason !== 'STOP') throw new RequestError('invalid_response', 502);
    const output = candidate.content?.parts?.filter((part: { thought?: boolean }) => !part.thought).map((part: { text?: string }) => part.text ?? '').join('');
    try { return reply({ steps: parseTaskSteps(JSON.parse(output ?? '')) }); }
    catch { throw new RequestError('invalid_response', 502); }
  } catch (error) {
    if (error instanceof RequestError) {
      console.error('[task-breakdown]', { code: error.message, status: error.status });
      return reply({ error: error.message }, error.status);
    }
    console.error('[task-breakdown unexpected error]', {
      message: error instanceof Error ? error.message : String(error),
      aborted: signal.aborted,
    });
    return reply({ error: signal.aborted ? 'timeout' : 'unavailable' }, signal.aborted ? 504 : 503);
  }
}

const nativeOrigins = new Set(['http://tauri.localhost', 'https://tauri.localhost', 'tauri://localhost',
  'http://127.0.0.1:1420', 'http://localhost:1420']);

export async function handleTaskBreakdown(request: Request, config: BreakdownConfig): Promise<Response> {
  const origin = request.headers.get('origin') || '';
  const native = nativeOrigins.has(origin);
  const headers: Record<string, string> = native ? { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type' } : {};
  if (request.method === 'OPTIONS') {
    return native ? new Response(null, { status: 204, headers }) : reply({ error: 'method_not_allowed' }, 405);
  }
  // CORS never substitutes for authorization: all native POST requests still
  // pass token verification, workspace RLS and rate limits above.
  const response = await handleTaskBreakdownRequest(request, config);
  for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
  return response;
}
