import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

export interface NoteImagesConfig { supabaseUrl?: string; anonKey?: string; serviceRoleKey?: string }
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const requests = new Map<string, { until: number; count: number }>();
let decoders = 0;
/** Decode and re-encode to reject corrupt/polyglot images and discard metadata. */
export async function prepareNoteImage(input: Uint8Array) {
  if (!input.length || input.length > 5 * 1024 * 1024) throw Error('Choose an image under 5 MB.');
  const decoder = sharp(input, { limitInputPixels: 40_000_000, failOn: 'warning' });
  const metadata = await decoder.metadata();
  if (!['png', 'jpeg', 'webp'].includes(metadata.format || '') || (metadata.pages ?? 1) !== 1) throw Error('Choose a still PNG, JPEG or WebP image.');
  const pipeline = decoder.rotate().resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true });
  const encoded = metadata.hasAlpha ? pipeline.png({ compressionLevel: 9 }) : pipeline.jpeg({ quality: 85 });
  const { data, info } = await encoded.toBuffer({ resolveWithObject: true });
  if (data.length > 2 * 1024 * 1024) throw Error('The processed image exceeds 2 MB. Choose a smaller image.');
  return { data, mimeType: info.format === 'png' ? 'image/png' : 'image/jpeg', width: info.width, height: info.height, sha256: createHash('sha256').update(data).digest('hex') };
}
export async function handleNoteImages(request: Request, config: NoteImagesConfig): Promise<Response> {
  const origin = request.headers.get('origin');
  const native = ['tauri://localhost', 'http://tauri.localhost', 'https://tauri.localhost'].includes(origin || '');
  const cors = native ? { 'Access-Control-Allow-Origin': origin!, Vary: 'Origin' } : {};
  const reply = (value: object, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store', ...cors } });
  if (origin && !native && origin !== new URL(request.url).origin) return reply({ error: 'This origin cannot upload note images.' }, 403);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...cors, 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'Authorization,Content-Type,X-Note-Id,X-Note-Image-Id' } });
  if (request.method !== 'POST') return reply({ error: 'Use POST.' }, 405);
  if (!config.supabaseUrl || !config.anonKey || !config.serviceRoleKey) return reply({ error: 'Private image uploads are not configured. Your note text is retained.' }, 503);
  const authorization = request.headers.get('authorization') || '';
  const noteId = request.headers.get('x-note-id') || '';
  const id = request.headers.get('x-note-image-id') || '';
  if (!authorization.startsWith('Bearer ') || !uuid.test(noteId) || !uuid.test(id)) return reply({ error: 'Sign in and save the note before adding an image.' }, 401);
  const actor = createClient(config.supabaseUrl, config.anonKey, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: authorization } } });
  const identity = await actor.auth.getUser(authorization.slice(7));
  if (identity.error || !identity.data.user) return reply({ error: 'Sign in again before uploading.' }, 401);
  const actorId = identity.data.user.id, now = Date.now();
  for (const [key, value] of requests) if (value.until < now) requests.delete(key);
  const limit = requests.get(actorId) ?? { until: now + 60_000, count: 0 };
  if (limit.count >= 12 || (!requests.has(actorId) && requests.size >= 1000)) return reply({ error: 'Wait a minute before uploading more images.' }, 429);
  requests.set(actorId, { ...limit, count: limit.count + 1 });
  if (decoders >= 2) return reply({ error: 'Image processing is busy. Retry in a moment.' }, 429);
  decoders++;
  const admin = createClient(config.supabaseUrl, config.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const reader = request.body?.getReader(); if (!reader) throw Error('Choose an image.');
    const chunks: Uint8Array[] = []; let length = 0;
    while (true) { const { done, value } = await reader.read(); if (done) break; length += value.byteLength; if (length > 5 * 1024 * 1024) { await reader.cancel(); throw Error('Choose an image under 5 MB.'); } chunks.push(value); }
    const image = await prepareNoteImage(Buffer.concat(chunks));
    const reservation = await actor.rpc('reserve_note_image', { request: { id, noteId, actorUserId: actorId, mimeType: image.mimeType, byteSize: image.data.length, width: image.width, height: image.height, sha256: image.sha256 } });
    if (reservation.error) return reply({ error: 'This note is unavailable for image editing. Save or refresh the note first.' }, 403);
    const objectPath = `${noteId}/${id}`;
    const uploaded = await admin.storage.from('kora-note-images').upload(objectPath, image.data, { upsert: false, contentType: image.mimeType, metadata: { sha256: image.sha256, width: image.width, height: image.height } });
    if (uploaded.error) {
      const existing = await admin.storage.from('kora-note-images').download(objectPath);
      if (!existing.data || createHash('sha256').update(new Uint8Array(await existing.data.arrayBuffer())).digest('hex') !== image.sha256) throw Error('The image upload failed. Try again; your text is retained.');
    }
    const finalized = await actor.rpc('finalize_note_image', { request: { id, actorUserId: actorId } });
    if (finalized.error) {
      const committed = await admin.from('note_images').select('state').eq('id', id).eq('note_id', noteId).eq('object_path', objectPath).eq('sha256', image.sha256).maybeSingle();
      if (committed.error || committed.data?.state !== 'ready') throw Error('Image access changed before upload completed. Refresh the note and retry the image.');
    }
    return reply({ id, noteId, mimeType: image.mimeType, byteSize: image.data.length, width: image.width, height: image.height });
  } catch (error) {
    // An ambiguous finalize may already have committed. Never delete its bytes.
    // Unfinalized reservations stay private and expire through operator cleanup.
    // Never return storage/auth provider errors or request credentials.
    const known = error instanceof Error && /^(Choose |The processed |The image upload |Image access )/.test(error.message);
    return reply({ error: known ? error.message : 'The image could not be decoded or uploaded. Choose a valid still image and retry.' }, 400);
  } finally { decoders--; }
}
