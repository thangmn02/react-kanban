import supabase, { authMode, requireSupabaseClient } from '../lib/supabase';

export const TASK_COVER_BUCKET = 'task-covers';
export const TASK_COVER_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const acceptedImageTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);

export type TaskCoverUploadErrorCode =
  | 'unsupported-type'
  | 'too-large'
  | 'missing-task'
  | 'missing-workspace'
  | 'upload-failed';

export class TaskCoverUploadError extends Error {
  code: TaskCoverUploadErrorCode;
  details?: unknown;

  constructor(code: TaskCoverUploadErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'TaskCoverUploadError';
    this.code = code;
    this.details = details;
  }
}

export interface UploadTaskCoverImageParams {
  file: File;
  taskId: string;
  workspaceId: string | null;
}

export interface UploadTaskCoverImageResult {
  imageUrl: string;
  storagePath: string | null;
  mode: 'supabase' | 'mock';
}

export function validateTaskCoverImage(file: File): void {
  if (!acceptedImageTypes.has(file.type)) {
    throw new TaskCoverUploadError('unsupported-type', 'Unsupported image type.');
  }

  if (file.size > TASK_COVER_MAX_FILE_SIZE_BYTES) {
    throw new TaskCoverUploadError('too-large', 'Image is too large.');
  }
}

function sanitizeFileName(fileName: string): string {
  const fallbackName = 'cover-image';
  const sanitized = fileName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return sanitized || fallbackName;
}

function buildTaskCoverStoragePath({ workspaceId, taskId, file }: UploadTaskCoverImageParams): string {
  return `${workspaceId}/${taskId}/${Date.now()}-${sanitizeFileName(file.name)}`;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }

      reject(new TaskCoverUploadError('upload-failed', 'Unable to read image.'));
    };
    reader.onerror = () => reject(new TaskCoverUploadError('upload-failed', 'Unable to read image.'));
    reader.readAsDataURL(file);
  });
}

export async function uploadTaskCoverImage(params: UploadTaskCoverImageParams): Promise<UploadTaskCoverImageResult> {
  validateTaskCoverImage(params.file);

  if (!params.taskId) {
    throw new TaskCoverUploadError('missing-task', 'Save the task before uploading a cover image.');
  }

  if (authMode !== 'supabase' || !supabase) {
    return {
      imageUrl: await fileToDataUrl(params.file),
      storagePath: null,
      mode: 'mock',
    };
  }

  if (!params.workspaceId) {
    throw new TaskCoverUploadError('missing-workspace', 'Workspace is required for cover uploads.');
  }

  const storagePath = buildTaskCoverStoragePath(params);
  const client = requireSupabaseClient();
  const { data, error } = await client.storage
    .from(TASK_COVER_BUCKET)
    .upload(storagePath, params.file, {
      cacheControl: '3600',
      contentType: params.file.type,
      upsert: false,
  });

  if (error) {
    if (import.meta.env.DEV) {
      console.error('[task-cover] Supabase Storage upload failed.', {
        bucket: TASK_COVER_BUCKET,
        storagePath,
        message: error.message,
        error,
      });
    }

    throw new TaskCoverUploadError('upload-failed', error.message, error);
  }

  const publicUrl = client.storage.from(TASK_COVER_BUCKET).getPublicUrl(data.path).data.publicUrl;

  return {
    imageUrl: publicUrl,
    storagePath: data.path,
    mode: 'supabase',
  };
}
