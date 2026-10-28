import { notesKey } from './notes-store';
import type { StorageScope } from '../../shared/storage/storageAdapter';

export interface UploadedNoteImage { id: string; width: number; height: number }
export interface NoteMedia {
  upload: (file: File, operationId?: string) => Promise<UploadedNoteImage>;
  download: (id: string) => Promise<Blob>;
  subscribe: (invalidate: () => void) => () => void;
  uploaded?: () => Promise<(UploadedNoteImage & { createdAt:string })[]>;
}
const validId = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export const noteImageIds = (html: string) => [...new Set([...html.matchAll(/data-kora-note-image="([a-f0-9-]+)"/gi)].map(match => match[1]).filter(id => validId.test(id)))];

/** Browser decode/re-encode for local media. The server independently validates connected uploads. */
export async function processDeviceImage(file: File) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) throw Error('Choose a PNG, JPEG or WebP under 5 MB.');
  const image = await createImageBitmap(file);
  try {
    if (image.width * image.height > 40_000_000) throw Error('Choose an image under 40 megapixels.');
    const ratio = Math.min(1, 2048 / image.width, 2048 / image.height), canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * ratio)); canvas.height = Math.max(1, Math.round(image.height * ratio));
    const context = canvas.getContext('2d'); if (!context) throw Error('Image processing is unavailable.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(Error('Image processing failed.')), file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png', 0.85));
    if (blob.size > 2 * 1024 * 1024) throw Error('The processed image exceeds 2 MB. Choose a smaller image.');
    return { blob, width: canvas.width, height: canvas.height };
  } finally { image.close(); }
}
const database = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open('kora-note-media', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('images');
  request.onerror = () => reject(Error('Device image storage is unavailable.'));
  request.onsuccess = () => resolve(request.result);
});
async function deviceAsset<T>(key: string, value?: T,insertOnly=false): Promise<T> {
  const db = await database();
  try { return await new Promise<T>((resolve, reject) => {
    const transaction = db.transaction('images', value === undefined ? 'readonly' : 'readwrite', { durability: 'strict' }), store = transaction.objectStore('images');
    const request = value === undefined ? store.get(key) : insertOnly?store.add(value,key):store.put(value, key);
    transaction.oncomplete = () => resolve(value ?? request.result);
    transaction.onerror = transaction.onabort = () => reject(Error('The device image was not saved. Your text is retained.'));
  }); } finally { db.close(); }
}
export function deviceNoteMedia(scope: StorageScope, noteId: string): NoteMedia {
  const prefix = `${notesKey(scope)}:${noteId}:`;
  return {
    async upload(file,operationId) { const image=await processDeviceImage(file),id=operationId??crypto.randomUUID();if(!validId.test(id))throw Error('Invalid device image operation.');const sha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await image.blob.arrayBuffer()))].map(value=>value.toString(16).padStart(2,'0')).join('');try{await deviceAsset(prefix+id,{...image,sha256},true);}catch(reason){const previous=await deviceAsset<{sha256?:string}>(prefix+id);if(previous?.sha256!==sha256)throw reason;}return{id,width:image.width,height:image.height}; },
    async download(id) { if (!validId.test(id)) throw Error('Invalid image identity.'); const image = await deviceAsset<{ blob: Blob }>(prefix + id); if (!image?.blob) throw Error('This device image is unavailable.'); return image.blob; },
    subscribe: () => () => {},
  };
}
