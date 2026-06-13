import { useCallback, useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useForm, useWatch, type Resolver } from 'react-hook-form';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { EditorContent, useEditor } from '@tiptap/react';
import Placeholder from '@tiptap/extension-placeholder';
import StarterKit from '@tiptap/starter-kit';
import { formatDistanceToNow, parseISO } from 'date-fns';

import Button from '../../atoms/Button';
import InputField from '../../molecules/InputField';
import type {
  ITaskItem,
  TaskDialogFormData,
  TaskAttachment,
  TaskChecklistItem,
  TaskLabel,
} from '../../../types/task.type';
import type { WorkspaceMember } from '../../../types/auth.type';
import { TASK_PRIORITIES } from '../../../constants';
import { useTaskActivityData } from '../../../hooks/useTaskActivityData';
import {
  getChecklistProgress,
  getTaskLabelClass,
  TASK_LABEL_COLOR_OPTIONS,
} from '../../../utils/taskCollections';
import { createLocalId } from '../../../utils/idGenerator';
import { formatFocusSessionDuration } from '../../../utils/timeFormatting';
import { mapWorkspaceMembersToAssignees, mockWorkspaceMembers } from '../../../utils/workspaceMembers';
import { Skeleton } from '../../atoms/skeleton';

interface TaskDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitTask: (data: TaskDialogFormData) => void;
  taskData?: ITaskItem | null;
  isFocusTask?: boolean;
  onToggleFocusTask?: () => void;
  workspaceMembers?: WorkspaceMember[];
  workspaceId?: string | null;
}

const taskSchema = yup.object({
  title: yup.string().required('Title is required'),
  description: yup.string(),
  priority: yup.string(),
  startDate: yup.string(),
  dueDate: yup.string(),
  image: yup.string(),
  assignees: yup.array(),
}).required();

interface TaskFormDrafts {
  label: { name: string; color: TaskLabel['color'] };
  attachment: { name: string; url: string };
  checklist: string;
}

const INITIAL_FORM_DRAFTS: TaskFormDrafts = {
  label: { name: '', color: 'sky' },
  attachment: { name: '', url: '' },
  checklist: '',
};

interface AddDraftItemOptions<T> {
  isValid: boolean;
  build: () => T;
  setList: Dispatch<SetStateAction<T[]>>;
  clearDraft: () => void;
}

function addDraftItem<T>({ isValid, build, setList, clearDraft }: AddDraftItemOptions<T>): void {
  if (!isValid) {
    return;
  }

  setList((currentItems) => [...currentItems, build()]);
  clearDraft();
}

interface TaskDialogValues {
  title: string;
  description?: string;
  priority?: string;
  startDate?: string;
  dueDate?: string;
  image?: string;
  assignees?: Array<{ name: string; avatar: string }>;
}

function TaskDialog({
  isOpen,
  onClose,
  onSubmitTask,
  taskData,
  isFocusTask = false,
  onToggleFocusTask,
  workspaceMembers = mockWorkspaceMembers,
  workspaceId = null,
}: TaskDialogProps) {
  const isEditMode = Boolean(taskData);
  const shouldReduceMotion = useReducedMotion();
  const [showAssigneeSelect, setShowAssigneeSelect] = useState(false);
  const [labels, setLabels] = useState<TaskLabel[]>([]);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [checklistItems, setChecklistItems] = useState<TaskChecklistItem[]>([]);
  const [formDrafts, setFormDrafts] = useState<TaskFormDrafts>(INITIAL_FORM_DRAFTS);

  const closeAssigneeSelect = useCallback(() => setShowAssigneeSelect(false), []);

  const {
    activities,
    focusSessions,
    isLoadingActivities,
    isLoadingFocusSessions,
  } = useTaskActivityData({
    isOpen,
    isEditMode,
    taskId: taskData?.id,
    workspaceId,
    onIdleReset: closeAssigneeSelect,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    control,
  } = useForm<TaskDialogValues>({
    resolver: yupResolver(taskSchema) as Resolver<TaskDialogValues>,
    defaultValues: {
      title: taskData?.title || '',
      description: taskData?.description || '',
      priority: taskData?.priority || 'Low',
      startDate: taskData?.startDate || '',
      dueDate: taskData?.dueDate || '',
      image: taskData?.image || '',
      assignees: taskData?.assignees || [],
    }
  });

  const currentAssignees = useWatch({ control, name: 'assignees' }) || [];
  const assigneeOptions = mapWorkspaceMembersToAssignees(workspaceMembers);
  const imagePreview = useWatch({ control, name: 'image' });
  const checklistProgress = getChecklistProgress(checklistItems);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Capture context, notes, or acceptance criteria...',
      }),
    ],
    content: taskData?.description || '',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'min-h-[180px] px-4 py-3 text-sm text-gray-900 focus:outline-none',
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      setValue('description', currentEditor.getHTML(), {
        shouldDirty: true,
        shouldValidate: true,
      });
    },
  });

  useEffect(() => {
    register('description');
    register('assignees');
  }, [register]);

  // Reset the dialog's local UI state when it opens or the active task changes.
  // This runs during render (React's recommended pattern for resetting state
  // when a prop changes) rather than inside an effect, which preserves the
  // original "reset on open / reset on task change" behavior while avoiding the
  // cascading-render that synchronous setState in an effect would cause. The
  // close/idle reset (closing the assignee select and clearing activity and
  // focus-session state) is owned by useTaskActivityData via resetActivityData
  // and onIdleReset, so this block only resets when the dialog is open.
  const [previousOpenContext, setPreviousOpenContext] = useState<{
    isOpen: boolean;
    taskData: ITaskItem | null | undefined;
  } | null>(null);

  if (
    !previousOpenContext ||
    previousOpenContext.isOpen !== isOpen ||
    previousOpenContext.taskData !== taskData
  ) {
    setPreviousOpenContext({ isOpen, taskData });

    if (isOpen) {
      setShowAssigneeSelect(false);
      setLabels(taskData?.labels || []);
      setAttachments(taskData?.attachments || []);
      setChecklistItems(taskData?.checklistItems || []);
      setFormDrafts((prev) => ({
        label: { name: '', color: prev.label.color },
        attachment: { name: '', url: '' },
        checklist: '',
      }));
    }
  }

  // Synchronize the form library and rich-text editor (external systems) with
  // the active task whenever the dialog is open.
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const nextValues = {
      title: taskData?.title || '',
      description: taskData?.description || '',
      priority: taskData?.priority || 'Low',
      startDate: taskData?.startDate || '',
      dueDate: taskData?.dueDate || '',
      image: taskData?.image || '',
      assignees: taskData?.assignees || [],
    };

    reset(nextValues);
    setValue('description', nextValues.description);
    setValue('assignees', nextValues.assignees);

    if (editor) {
      editor.commands.setContent(nextValues.description);
    }
  }, [editor, isOpen, reset, setValue, taskData]);

  const handleFormSubmit = (formData: TaskDialogValues) => {
    onSubmitTask({
      title: formData.title.trim(),
      description: formData.description || '',
      priority: formData.priority as TaskDialogFormData['priority'],
      startDate: formData.startDate || '',
      dueDate: formData.dueDate || '',
      assignees: formData.assignees || [],
      image: formData.image?.trim() || '',
      labels,
      attachments,
      checklistItems,
    });
  };

  const handleAddLabel = () => {
    const nextLabelName = formDrafts.label.name.trim();

    addDraftItem<TaskLabel>({
      isValid: Boolean(nextLabelName),
      build: () => ({
        id: createLocalId('label'),
        name: nextLabelName,
        color: formDrafts.label.color,
      }),
      setList: setLabels,
      clearDraft: () => setFormDrafts((prev) => ({ ...prev, label: { ...prev.label, name: '' } })),
    });
  };

  const handleAddAttachment = () => {
    const nextAttachmentName = formDrafts.attachment.name.trim();
    const nextAttachmentUrl = formDrafts.attachment.url.trim();

    let isValidAttachment = false;

    if (nextAttachmentName && nextAttachmentUrl) {
      try {
        new URL(nextAttachmentUrl);
        isValidAttachment = true;
      } catch {
        isValidAttachment = false;
      }
    }

    addDraftItem<TaskAttachment>({
      isValid: isValidAttachment,
      build: () => ({
        id: createLocalId('attachment'),
        name: nextAttachmentName,
        url: nextAttachmentUrl,
        type: 'link',
      }),
      setList: setAttachments,
      clearDraft: () => setFormDrafts((prev) => ({ ...prev, attachment: { name: '', url: '' } })),
    });
  };

  const handleAddChecklistItem = () => {
    const nextChecklistText = formDrafts.checklist.trim();

    addDraftItem<TaskChecklistItem>({
      isValid: Boolean(nextChecklistText),
      build: () => ({
        id: createLocalId('checklist'),
        text: nextChecklistText,
        isDone: false,
      }),
      setList: setChecklistItems,
      clearDraft: () => setFormDrafts((prev) => ({ ...prev, checklist: '' })),
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div className="fixed inset-0 z-[60]">
          <motion.div
            className="absolute inset-0 bg-slate-950/30 backdrop-blur-[3px]"
            initial={shouldReduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            onClick={onClose}
          />

          <motion.aside
            className="absolute right-0 top-0 flex h-full w-full max-w-3xl flex-col overflow-hidden rounded-l-[2rem] bg-white shadow-[0_32px_100px_rgba(15,23,42,0.28)]"
            initial={shouldReduceMotion ? false : { x: '100%', opacity: 0.72, scale: 0.98 }}
            animate={{ x: 0, opacity: 1, scale: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { x: '100%', opacity: 0, scale: 0.98 }}
            transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 220, damping: 26, mass: 0.9 }}
          >
        <div className="flex items-start justify-between border-b border-gray-200 bg-white px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">
              {isEditMode ? 'Task Detail' : 'Create Task'}
            </p>
            <h3 className="mt-2 text-2xl font-bold tracking-tight text-gray-900">
              {isEditMode ? 'Edit task in context' : 'Add a richer task'}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Keep the board visible while editing the task, checklist, labels, and attachments.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isEditMode && onToggleFocusTask && (
              <button
                type="button"
                onClick={onToggleFocusTask}
                className={`rounded-2xl border px-3 py-2 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-sky-300 ${
                  isFocusTask
                    ? 'border-sky-200 bg-sky-50 text-sky-700'
                    : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                }`}
                aria-pressed={isFocusTask}
              >
                {isFocusTask ? 'In Focus Dock' : 'Add Focus'}
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              aria-label="Close task drawer"
            >
              <svg className="h-5 w-5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
            <div className="grid gap-8 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)]">
              <div className="space-y-8">
                <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">
                      Core details
                    </h4>
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                      Board-first editing
                    </span>
                  </div>

                  <InputField
                    label="Title"
                    messageError={errors.title?.message}
                    placeholder="Refine the task title"
                    {...register('title')}
                  />

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-gray-700">
                      Description
                    </label>
                    <div className="flex items-center gap-2 rounded-t-xl border border-gray-300 border-b-0 bg-gray-50 px-3 py-2">
                      <button
                        type="button"
                        onClick={() => editor?.chain().focus().toggleBold().run()}
                        className={`cursor-pointer rounded-md px-2 py-1 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                          editor?.isActive('bold') ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                        }`}
                        aria-label="Bold"
                        aria-pressed={editor?.isActive('bold') ?? false}
                      >
                        <span className="font-bold">B</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => editor?.chain().focus().toggleItalic().run()}
                        className={`cursor-pointer rounded-md px-2 py-1 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                          editor?.isActive('italic') ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                        }`}
                        aria-label="Italic"
                        aria-pressed={editor?.isActive('italic') ?? false}
                      >
                        <span className="italic">I</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => editor?.chain().focus().toggleBulletList().run()}
                        className={`cursor-pointer rounded-md px-2 py-1 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                          editor?.isActive('bulletList') ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                        }`}
                        aria-label="Bullet list"
                        aria-pressed={editor?.isActive('bulletList') ?? false}
                      >
                        •
                      </button>
                    </div>

                    <div className="overflow-hidden rounded-b-xl border border-gray-300 bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500">
                      <EditorContent editor={editor} className="w-full" />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-gray-700">
                      Cover image URL
                    </label>
                    <input
                      type="url"
                      {...register('image')}
                      placeholder="https://example.com/cover.jpg"
                      className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />

                    {imagePreview && (
                      <div className="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                        <img
                          src={imagePreview}
                          alt="Task cover preview"
                          className="h-44 w-full object-cover"
                        />
                      </div>
                    )}
                  </div>
                </section>

                <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">
                        Checklist
                      </h4>
                      <p className="mt-1 text-sm text-gray-500">
                        Break work into smaller steps and show progress directly on the card.
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      {checklistProgress.completed}/{checklistProgress.total}
                    </span>
                  </div>

                  <div className="h-2 rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-[width] duration-200"
                      style={{ width: `${checklistProgress.percent}%` }}
                    />
                  </div>

                  <div className="space-y-3">
                    {checklistItems.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-5 text-sm text-gray-400">
                        No checklist items yet.
                      </div>
                    ) : (
                      checklistItems.map((item) => (
                        <div key={item.id} className="flex items-center gap-3 rounded-xl border border-gray-200 px-3 py-2.5">
                          <input
                            type="checkbox"
                            checked={item.isDone}
                            onChange={() => {
                              setChecklistItems((currentChecklistItems) => currentChecklistItems.map((checklistItem) => (
                                checklistItem.id === item.id
                                  ? { ...checklistItem, isDone: !checklistItem.isDone }
                                  : checklistItem
                              )));
                            }}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <input
                            type="text"
                            value={item.text}
                            onChange={(event) => {
                              const nextValue = event.target.value;
                              setChecklistItems((currentChecklistItems) => currentChecklistItems.map((checklistItem) => (
                                checklistItem.id === item.id
                                  ? { ...checklistItem, text: nextValue }
                                  : checklistItem
                              )));
                            }}
                            className={`flex-1 bg-transparent text-sm focus:outline-none ${item.isDone ? 'text-gray-400 line-through' : 'text-gray-700'}`}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setChecklistItems((currentChecklistItems) => currentChecklistItems.filter((checklistItem) => checklistItem.id !== item.id));
                            }}
                            className="cursor-pointer rounded-md p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
                            aria-label={`Remove checklist item: ${item.text || 'untitled'}`}
                          >
                            <svg className="h-4 w-4" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      ))
                    )}

                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={formDrafts.checklist}
                        onChange={(event) => setFormDrafts((prev) => ({ ...prev, checklist: event.target.value }))}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            handleAddChecklistItem();
                          }
                        }}
                        placeholder="Add a checklist item"
                        className="flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <Button text="Add item" variant="outline" onClick={handleAddChecklistItem} />
                    </div>
                  </div>
                </section>
              </div>

              <div className="space-y-8">
                <section className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">
                    Ownership and timing
                  </h4>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-gray-700">
                      Assignees
                    </label>
                    <div className="flex flex-wrap items-center gap-3">
                      {currentAssignees.length > 0 ? (
                        <div className="flex -space-x-2 overflow-hidden">
                          {currentAssignees.map((assignee) => (
                            <img
                              key={assignee.name}
                              src={assignee.avatar}
                              alt={assignee.name}
                              className="h-9 w-9 rounded-full border-2 border-white object-cover"
                              title={assignee.name}
                            />
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm italic text-gray-400">No one assigned yet</span>
                      )}

                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowAssigneeSelect((currentState) => !currentState)}
                          className="inline-flex cursor-pointer items-center rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                          aria-haspopup="true"
                          aria-expanded={showAssigneeSelect}
                        >
                          <svg className="mr-2 h-4 w-4 text-gray-500" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                          </svg>
                          Assign members
                        </button>

                        {showAssigneeSelect && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setShowAssigneeSelect(false)} />
                            <div className="absolute left-0 z-20 mt-2 w-60 rounded-xl border border-gray-200 bg-white p-2 shadow-2xl">
                              <div className="mb-2 border-b border-gray-100 px-2 pb-2 text-xs font-bold uppercase tracking-wider text-gray-500">
                                Select members
                              </div>
                              <div className="max-h-56 space-y-1 overflow-y-auto">
                                {assigneeOptions.map((member) => {
                                  const isSelected = currentAssignees.some((assignee) => assignee.name === member.name);

                                  return (
                                    <button
                                      type="button"
                                      key={member.name}
                                      onClick={() => {
                                        const nextAssignees = isSelected
                                          ? currentAssignees.filter((assignee) => assignee.name !== member.name)
                                          : [...currentAssignees, { name: member.name, avatar: member.avatar }];

                                        setValue('assignees', nextAssignees, { shouldDirty: true, shouldValidate: true });
                                      }}
                                      className="flex w-full cursor-pointer items-center justify-between rounded-lg px-2 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-300"
                                    >
                                      <div className="flex items-center gap-2">
                                        <img src={member.avatar} alt={member.name} className="h-6 w-6 rounded-full object-cover" />
                                        <span>{member.name}</span>
                                      </div>
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        readOnly
                                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                      />
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-gray-700">
                      Priority
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {TASK_PRIORITIES.map((priority) => (
                        <label
                          key={priority}
                          className="inline-flex cursor-pointer items-center rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100"
                        >
                          <input
                            type="radio"
                            value={priority}
                            {...register('priority')}
                            className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-2">{priority}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-gray-700">Start date</label>
                      <input
                        type="date"
                        {...register('startDate')}
                        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-gray-700">Due date</label>
                      <input
                        type="date"
                        {...register('dueDate')}
                        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </section>

                <section className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div>
                    <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">
                      Labels
                    </h4>
                    <p className="mt-1 text-sm text-gray-500">
                      Keep priority for urgency and use labels for category.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {labels.length === 0 && (
                      <span className="text-sm italic text-gray-400">No labels added yet</span>
                    )}
                    {labels.map((label) => (
                      <span
                        key={label.id}
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${getTaskLabelClass(label.color)}`}
                      >
                        {label.name}
                        <button
                          type="button"
                          onClick={() => setLabels((currentLabels) => currentLabels.filter((currentLabel) => currentLabel.id !== label.id))}
                          className="cursor-pointer rounded-full text-current/70 transition-colors hover:text-current focus:outline-none focus-visible:ring-2 focus-visible:ring-current"
                          aria-label={`Remove label: ${label.name}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>

                  <div className="space-y-3">
                    <input
                      type="text"
                      value={formDrafts.label.name}
                      onChange={(event) => setFormDrafts((prev) => ({ ...prev, label: { ...prev.label, name: event.target.value } }))}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          handleAddLabel();
                        }
                      }}
                      placeholder="Design, Backend, Presentation..."
                      className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />

                    <div className="flex flex-wrap items-center gap-2">
                      {TASK_LABEL_COLOR_OPTIONS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setFormDrafts((prev) => ({ ...prev, label: { ...prev.label, color } }))}
                          className={`cursor-pointer rounded-full px-3 py-1 text-xs font-semibold capitalize transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/30 ${getTaskLabelClass(color)} ${
                            formDrafts.label.color === color ? 'scale-105 ring-2 ring-gray-900/10' : ''
                          }`}
                          aria-label={`Label color: ${color}`}
                          aria-pressed={formDrafts.label.color === color}
                        >
                          {color}
                        </button>
                      ))}
                    </div>

                    <Button text="Add label" variant="outline" onClick={handleAddLabel} />
                  </div>
                </section>

                <section className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div>
                    <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">
                      Attachments
                    </h4>
                    <p className="mt-1 text-sm text-gray-500">
                      Lightweight link attachments for briefs, docs, boards, or repos.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {attachments.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-5 text-sm text-gray-400">
                        No attachments yet.
                      </div>
                    ) : (
                      attachments.map((attachment) => (
                        <div key={attachment.id} className="flex items-center gap-3 rounded-xl border border-gray-200 px-3 py-3">
                          <div className="rounded-lg bg-blue-50 p-2 text-blue-700">
                            <svg className="h-4 w-4" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 11-5.656-5.656l1.5-1.5m7.328-1.328a4 4 0 010-5.656l3-3a4 4 0 115.656 5.656l-1.5 1.5" />
                            </svg>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-gray-800">{attachment.name}</p>
                            <a
                              href={attachment.url}
                              target="_blank"
                              rel="noreferrer"
                              className="truncate text-xs text-blue-600 hover:text-blue-800"
                            >
                              {attachment.url}
                            </a>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setAttachments((currentAttachments) => currentAttachments.filter((currentAttachment) => currentAttachment.id !== attachment.id));
                            }}
                            className="cursor-pointer rounded-md p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
                            aria-label={`Remove attachment: ${attachment.name}`}
                          >
                            <svg className="h-4 w-4" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="space-y-3">
                    <input
                      type="text"
                      value={formDrafts.attachment.name}
                      onChange={(event) => setFormDrafts((prev) => ({ ...prev, attachment: { ...prev.attachment, name: event.target.value } }))}
                      placeholder="Attachment name"
                      className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="url"
                      value={formDrafts.attachment.url}
                      onChange={(event) => setFormDrafts((prev) => ({ ...prev, attachment: { ...prev.attachment, url: event.target.value } }))}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          handleAddAttachment();
                        }
                      }}
                      placeholder="https://..."
                      className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <Button text="Add attachment" variant="outline" onClick={handleAddAttachment} />
                  </div>
                </section>

                {isEditMode && taskData && (
                  <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm" aria-busy={isLoadingFocusSessions}>
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">
                        Focus history
                      </h4>
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                        {focusSessions.length} sessions
                      </span>
                    </div>

                    {isLoadingFocusSessions ? (
                      <div aria-hidden="true" className="space-y-2">
                        {Array.from({ length: 2 }).map((_, index) => (
                          <div key={index} className="flex items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50/60 px-3 py-3">
                            <div className="min-w-0 flex-1">
                              <Skeleton className="h-3.5 w-40" />
                              <Skeleton className="mt-2 h-3 w-24" />
                            </div>
                            <Skeleton className="h-5 w-14" rounded="rounded-full" />
                          </div>
                        ))}
                      </div>
                    ) : focusSessions.length > 0 ? (
                      <div className="space-y-2">
                        {focusSessions.map((session) => {
                          let relativeTime = 'just now';

                          try {
                            relativeTime = formatDistanceToNow(parseISO(session.createdAt), { addSuffix: true });
                          } catch {
                            relativeTime = 'just now';
                          }

                          return (
                            <div key={session.id} className="flex items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50/60 px-3 py-3">
                              <div>
                                <p className="text-sm font-semibold text-slate-800">
                                  {formatFocusSessionDuration(session.durationSeconds)} · {session.status}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">{relativeTime}</p>
                              </div>
                              <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold capitalize text-blue-700">
                                {session.mode}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-5 text-sm italic text-gray-400">
                        No focus sessions logged for this task yet.
                      </div>
                    )}
                  </section>
                )}

                {isEditMode && taskData && (
                  <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm" aria-busy={isLoadingActivities}>
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">
                        Activity log
                      </h4>
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                        {activities.length} events
                      </span>
                    </div>

                    {isLoadingActivities ? (
                      <div aria-hidden="true" className="space-y-4">
                        {Array.from({ length: 3 }).map((_, index) => (
                          <div key={index} className="flex gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-3">
                            <Skeleton className="h-8 w-8 shrink-0" rounded="rounded-full" />
                            <div className="min-w-0 flex-1">
                              <Skeleton className="h-3.5 w-3/4" />
                              <Skeleton className="mt-2 h-3 w-1/3" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : activities.length > 0 ? (
                      <div className="max-h-72 space-y-4 overflow-y-auto pr-2">
                        {activities.map((activity) => {
                          let relativeTime = 'just now';

                          try {
                            relativeTime = formatDistanceToNow(parseISO(activity.created_at), { addSuffix: true });
                          } catch {
                            relativeTime = 'just now';
                          }

                          return (
                            <div key={activity.id} className="flex gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-3">
                              <img
                                className="h-9 w-9 rounded-full border border-white object-cover shadow-sm"
                                src={activity.actor.avatar}
                                alt={activity.actor.name}
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm text-gray-600">
                                  <span className="font-semibold text-gray-900">{activity.actor.name}</span>{' '}
                                  {activity.details.description}
                                </p>
                                <p className="mt-1 text-xs text-gray-400">{relativeTime}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-5 text-sm italic text-gray-400">
                        No activity logged for this task yet.
                      </div>
                    )}
                  </section>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 bg-white px-6 py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="text-sm text-gray-500">
                {isEditMode ? 'Changes save back into the same task record.' : 'New task will be created in the selected list.'}
              </div>
              <div className="flex items-center gap-3">
                <Button text="Cancel" variant="outline" onClick={onClose} />
                <Button
                  text={isEditMode ? 'Save changes' : 'Add new task'}
                  variant="primary"
                  onClick={handleSubmit(handleFormSubmit)}
                />
              </div>
            </div>
          </div>
        </form>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default TaskDialog;
