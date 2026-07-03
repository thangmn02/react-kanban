import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent, type ClipboardEvent } from 'react';

import {
  COVER_COLOR_PRESETS,
  DEFAULT_TASK_COVER,
  getTaskCover,
  setTaskCover,
  type TaskCover,
  type TaskCoverSize,
  type TaskCoverType,
} from '../../utils/coverBackground';
import { useI18n } from '../../i18n';
import {
  TASK_COVER_MAX_FILE_SIZE_BYTES,
  TaskCoverUploadError,
  uploadTaskCoverImage,
} from '../../services/taskCoverUpload.service';
import { updateTask } from '../../services/task.service';
import type { TranslationKey } from '../../i18n/context';

interface TaskCoverPickerProps {
  taskId: string;
  imageUrl: string;
  workspaceId: string | null;
  onImageUrlChange: (url: string) => void;
}

const TYPE_OPTIONS: { value: TaskCoverType; labelKey: TranslationKey }[] = [
  { value: 'none', labelKey: 'cover.type.none' },
  { value: 'color', labelKey: 'cover.type.color' },
  { value: 'image', labelKey: 'cover.type.image' },
];

const SIZE_OPTIONS: { value: TaskCoverSize; labelKey: TranslationKey }[] = [
  { value: 'header', labelKey: 'cover.size.header' },
  { value: 'full', labelKey: 'cover.size.full' },
];

/**
 * Visual cover picker for the Task Detail dialog. Uses swatches and toggle
 * buttons instead of raw text fields. Cover type/color/size persist locally
 * (localStorage); the image URL is delegated to the parent form so it syncs
 * to Supabase via the existing `tasks.image` column.
 */
export default function TaskCoverPicker({ taskId, imageUrl, workspaceId, onImageUrlChange }: TaskCoverPickerProps) {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [cover, setCover] = useState<TaskCover>(DEFAULT_TASK_COVER);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [statusKey, setStatusKey] = useState<string | null>(null);

  // Load the persisted cover when the task changes.
  useEffect(() => {
    const persistedCover = getTaskCover(taskId);
    setCover(
      persistedCover.type === 'none' && imageUrl
        ? { ...persistedCover, type: 'image' }
        : persistedCover
    );
  }, [imageUrl, taskId]);

  const updateCover = (next: Partial<TaskCover>) => {
    const merged = { ...cover, ...next };
    setCover(merged);
    setTaskCover(taskId, merged);
  };

  const applyImageUrl = (nextUrl: string) => {
    onImageUrlChange(nextUrl);
    updateCover({ type: 'image', color: null, imageUrl: null });
  };

  const handleTypeChange = (type: TaskCoverType) => {
    setErrorKey(null);
    setStatusKey(null);
    updateCover({
      type,
      color: type === 'color' ? (cover.color || COVER_COLOR_PRESETS[0].value) : null,
      imageUrl: null,
    });
  };

  const handleRemoveCover = () => {
    onImageUrlChange('');
    setErrorKey(null);
    setStatusKey(null);
    updateCover(DEFAULT_TASK_COVER);
  };

  const resolveUploadErrorKey = (error: unknown): string => {
    if (error instanceof TaskCoverUploadError) {
      if (error.code === 'unsupported-type') {
        return 'cover.error.unsupportedType';
      }

      if (error.code === 'too-large') {
        return 'cover.error.tooLarge';
      }

      if (error.code === 'missing-workspace') {
        return 'cover.error.missingWorkspace';
      }
    }

    return 'cover.error.uploadFailed';
  };

  const persistUploadedImageUrl = async (nextUrl: string, mode: 'supabase' | 'mock') => {
    applyImageUrl(nextUrl);

    if (mode === 'supabase') {
      await updateTask(taskId, { image: nextUrl });
    }
  };

  const uploadImageFile = async (file: File) => {
    setIsUploading(true);
    setErrorKey(null);
    setStatusKey(null);

    try {
      const result = await uploadTaskCoverImage({
        file,
        taskId,
        workspaceId,
      });

      await persistUploadedImageUrl(result.imageUrl, result.mode);
      setStatusKey('cover.status.uploaded');
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[task-cover] Unable to upload or persist task cover image.', error);
      }

      setErrorKey(resolveUploadErrorKey(error));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const uploadFirstImageFile = (files: FileList | File[]) => {
    const nextFile = Array.from(files)[0];

    if (nextFile) {
      void uploadImageFile(nextFile);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragActive(false);
    uploadFirstImageFile(event.dataTransfer.files);
  };

  const getFirstClipboardImageFile = (event: ClipboardEvent<HTMLDivElement>): File | null => {
    const itemFile = Array.from(event.clipboardData.items)
      .find((item) => item.kind === 'file' && item.type.startsWith('image/'))
      ?.getAsFile();

    if (itemFile) {
      return itemFile;
    }

    return Array.from(event.clipboardData.files)
      .find((file) => file.type.startsWith('image/')) ?? null;
  };

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    const imageFile = getFirstClipboardImageFile(event);

    if (!imageFile) {
      return;
    }

    event.preventDefault();
    void uploadImageFile(imageFile);
  };

  const handleUploadAreaKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      fileInputRef.current?.click();
    }
  };

  const effectiveImageUrl = imageUrl;
  const previewHeight = cover.size === 'full' ? 'h-40' : 'h-20';
  const showPreview = cover.type === 'color' || (cover.type === 'image' && effectiveImageUrl);
  const hasImageCover = cover.type === 'image' && Boolean(effectiveImageUrl);
  const acceptedHelpText = t('cover.acceptedFormats', { size: `${TASK_COVER_MAX_FILE_SIZE_BYTES / 1024 / 1024}MB` });

  return (
    <div className="space-y-3" onPaste={handlePaste}>
      {/* Live preview */}
      {showPreview && (
        <div
          className={`w-full overflow-hidden rounded-2xl border border-slate-200 ${previewHeight}`}
          style={
            cover.type === 'color'
              ? { backgroundColor: cover.color || undefined }
              : undefined
          }
        >
          {cover.type === 'image' && effectiveImageUrl && (
            <img src={effectiveImageUrl} alt="" className="h-full w-full object-cover" />
          )}
        </div>
      )}

      {/* Type toggle */}
      <div className="flex gap-1.5">
        {TYPE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => handleTypeChange(option.value)}
            disabled={isUploading}
            className={`flex-1 cursor-pointer rounded-xl border px-3 py-2 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
              cover.type === option.value
                ? 'border-blue-300 bg-blue-50 text-blue-700'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
            aria-pressed={cover.type === option.value}
          >
            {t(option.labelKey)}
          </button>
        ))}
      </div>

      {/* Color swatches */}
      {cover.type === 'color' && (
        <div className="grid grid-cols-6 gap-2">
          {COVER_COLOR_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => updateCover({ color: preset.value })}
              className={`h-8 cursor-pointer rounded-lg border-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                cover.color === preset.value
                  ? 'border-slate-900 scale-110'
                  : 'border-white shadow-sm hover:scale-105'
              }`}
              style={{ backgroundColor: preset.value }}
              aria-label={preset.label}
              aria-pressed={cover.color === preset.value}
              title={preset.label}
            />
          ))}
        </div>
      )}

      {/* Image URL input */}
      {cover.type === 'image' && (
        <div className="space-y-3">
          <div
            role="button"
            tabIndex={0}
            onKeyDown={handleUploadAreaKeyDown}
            onDragEnter={(event) => {
              event.preventDefault();
              setIsDragActive(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragActive(true);
            }}
            onDragLeave={() => setIsDragActive(false)}
            onDrop={handleDrop}
            className={`rounded-2xl border border-dashed px-4 py-4 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
              isDragActive
                ? 'border-sky-300 bg-sky-50'
                : 'border-slate-200 bg-slate-50/80 hover:border-slate-300 hover:bg-white'
            }`}
            aria-label={t('cover.dropImageHere')}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {isDragActive ? t('cover.dropImageHere') : t('cover.uploadHint')}
                </p>
                <p className="mt-1 text-xs text-slate-500">{acceptedHelpText}</p>
                <p className="mt-1 text-xs text-slate-400">{t('cover.pasteImage')}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="cursor-pointer rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                >
                  {hasImageCover ? t('cover.replaceImage') : t('cover.uploadImage')}
                </button>
                {hasImageCover && (
                  <button
                    type="button"
                    onClick={handleRemoveCover}
                    disabled={isUploading}
                    className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                  >
                    {t('cover.removeCover')}
                  </button>
                )}
              </div>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(event) => {
              if (event.target.files) {
                uploadFirstImageFile(event.target.files);
              }
            }}
          />

          <input
            type="url"
            value={effectiveImageUrl}
            onChange={(e) => {
              applyImageUrl(e.target.value);
              setErrorKey(null);
              setStatusKey(null);
            }}
            placeholder={t('cover.imageUrlPlaceholder')}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 transition focus:border-sky-300 focus:outline-none focus:ring-4 focus:ring-sky-100"
            aria-label={t('cover.imageUrlLabel')}
          />

          {isUploading && (
            <p className="text-xs font-semibold text-sky-700" role="status">
              {t('cover.uploading')}
            </p>
          )}
          {statusKey && !isUploading && (
            <p className="text-xs font-semibold text-emerald-700" role="status">
              {t(statusKey as TranslationKey)}
            </p>
          )}
          {errorKey && (
            <p className="text-xs font-semibold text-rose-700" role="alert">
              {t(errorKey as TranslationKey)}
            </p>
          )}
        </div>
      )}

      {/* Size toggle — only relevant when a cover is active */}
      {cover.type !== 'none' && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            {t('cover.size.label')}
          </span>
          {SIZE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => updateCover({ size: option.value })}
              className={`cursor-pointer rounded-lg border px-2.5 py-1 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                cover.size === option.value
                  ? 'border-slate-300 bg-slate-100 text-slate-900'
                  : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
              }`}
              aria-pressed={cover.size === option.value}
            >
              {t(option.labelKey)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
