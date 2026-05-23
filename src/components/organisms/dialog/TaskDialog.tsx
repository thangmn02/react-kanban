import { useEffect, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { EditorContent, useEditor } from '@tiptap/react';
import Placeholder from '@tiptap/extension-placeholder';
import StarterKit from '@tiptap/starter-kit';

import Button from '../../atoms/Button';
import ContentDialog from '../../molecules/dialog/ContentDialog';
import InputField from '../../molecules/InputField';
import type { TaskDialogFormData } from '../../../App';
import type { ITaskItem, ITaskActivity } from '../../../types/task.type';
import { AVAILABLE_ASSIGNEES } from '../../organisms/QuickSearch';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { fetchActivitiesForTask } from '../../../services/activity.service';

interface TaskDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitTask: (data: TaskDialogFormData) => void;
  taskData?: ITaskItem | null;
}

const taskSchema = yup.object({
  title: yup.string().required('Title is required'),
  description: yup.string(),
  priority: yup.string(),
  startDate: yup.string(),
  dueDate: yup.string(),
  assignees: yup.array(),
}).required();

const priorityOptions: Array<NonNullable<ITaskItem['priority']>> = ['High', 'Medium', 'Low', 'Lowest'];

interface TaskDialogValues {
  title: string;
  description?: string;
  priority?: string;
  startDate?: string;
  dueDate?: string;
  assignees?: Array<{ name: string; avatar: string }>;
}

function TaskDialog({ isOpen, onClose, onSubmitTask, taskData }: TaskDialogProps) {
  const isEditMode = Boolean(taskData);
  const [showAssigneeSelect, setShowAssigneeSelect] = useState(false);
  const [activities, setActivities] = useState<ITaskActivity[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);

  const { register, handleSubmit, formState: { errors }, reset, setValue, watch } = useForm<TaskDialogValues>({
    resolver: yupResolver(taskSchema) as Resolver<TaskDialogValues>,
    defaultValues: {
      title: taskData?.title || '',
      description: taskData?.description || '',
      priority: taskData?.priority || 'Low',
      startDate: taskData?.startDate || '',
      dueDate: taskData?.dueDate || '',
      assignees: taskData?.assignees || [],
    }
  });

  const currentAssignees = watch('assignees') || [];

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Write a description here...',
      }),
    ],
    content: taskData?.description || '',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'min-h-[160px] px-3 py-2 text-sm text-gray-900 focus:outline-none',
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

  useEffect(() => {
    if (!isOpen) {
      if (editor) {
        editor.commands.clearContent();
      }
      return;
    }

    const nextValues = {
      title: taskData?.title || '',
      description: taskData?.description || '',
      priority: taskData?.priority || 'Low',
      startDate: taskData?.startDate || '',
      dueDate: taskData?.dueDate || '',
      assignees: taskData?.assignees || [],
    };

    reset(nextValues);
    setValue('description', nextValues.description);
    setValue('assignees', nextValues.assignees);

    if (editor) {
      editor.commands.setContent(nextValues.description);
    }
  }, [editor, isOpen, reset, setValue, taskData]);

  useEffect(() => {
    if (isOpen && isEditMode && taskData?.id) {
      setIsLoadingActivities(true);
      fetchActivitiesForTask(taskData.id)
        .then((data) => setActivities(data))
        .catch((err) => console.error('Failed to load activities:', err))
        .finally(() => setIsLoadingActivities(false));
    } else {
      setActivities([]);
    }
  }, [isOpen, isEditMode, taskData?.id]);

  if (!isOpen) return null;

  const handleFormSubmit = (formData: TaskDialogValues) => {
    onSubmitTask({
      title: formData.title,
      description: formData.description || '',
      priority: formData.priority as TaskDialogFormData['priority'],
      startDate: formData.startDate || '',
      dueDate: formData.dueDate || '',
      assignees: formData.assignees || [],
    });
  };

  return (
    <ContentDialog
      onSubmit={handleSubmit(handleFormSubmit)}
      onClose={onClose}
      title={(
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-900">
            {isEditMode ? 'Edit task' : 'Add new task'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 cursor-pointer"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
      modalFooter={(
        <div className="mt-6 flex w-full justify-start space-x-3 border-t border-gray-200 pt-6">
          <Button
            text={isEditMode ? 'Save changes' : 'Add new task'}
            variant="primary"
            onClick={handleSubmit(handleFormSubmit)}
            icon={!isEditMode ? (
              <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            ) : undefined}
          />
          <Button
            text="Cancel"
            variant="outline"
            onClick={onClose}
          />
        </div>
      )}
      className="max-h-[90vh] w-full max-w-3xl overflow-y-auto p-6"
    >
      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <div className="grid gap-6 md:grid-cols-2">
          {/* Title & Description section */}
          <div className="flex flex-col space-y-4">
            <InputField
              label="Title"
              messageError={errors.title?.message}
              placeholder="Add title here"
              {...register('title')}
            />

            <div className="flex flex-1 flex-col">
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Description
              </label>

              <div className="flex items-center space-x-2 rounded-t-lg border border-gray-300 border-b-0 bg-gray-50 px-2 py-1">
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleBold().run()}
                  className={`rounded p-1.5 ${editor?.isActive('bold') ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:bg-gray-200 hover:text-gray-700'}`}
                >
                  <span className="px-1 font-bold">B</span>
                </button>
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleItalic().run()}
                  className={`rounded p-1.5 ${editor?.isActive('italic') ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:bg-gray-200 hover:text-gray-700'}`}
                >
                  <span className="px-1 italic">I</span>
                </button>
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleBulletList().run()}
                  className={`rounded p-1.5 ${editor?.isActive('bulletList') ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:bg-gray-200 hover:text-gray-700'}`}
                >
                  <span className="px-1">&bull;</span>
                </button>
              </div>

              <div className="min-h-[160px] flex-1 overflow-hidden rounded-b-lg border border-gray-300 bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
                <EditorContent editor={editor} className="w-full" />
              </div>

              {errors.description && (
                <span className="mt-2 text-sm text-red-500">{errors.description.message}</span>
              )}
            </div>
          </div>

          {/* Members, Priority, and Dates section */}
          <div className="space-y-6">
            {/* Assignees (Interactive Checklist selection) */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Assignees
              </label>
              <div className="flex flex-wrap items-center gap-3">
                {/* Visual Avatar Strip */}
                {currentAssignees.length > 0 ? (
                  <div className="flex -space-x-1.5 overflow-hidden">
                    {currentAssignees.map((assignee, idx) => (
                      <img
                        key={idx}
                        src={assignee.avatar}
                        alt={assignee.name}
                        className="h-8 w-8 rounded-full border-2 border-white object-cover"
                        title={assignee.name}
                      />
                    ))}
                  </div>
                ) : (
                  <span className="text-sm text-gray-400 italic">No one assigned yet</span>
                )}

                {/* Checklist Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowAssigneeSelect(!showAssigneeSelect)}
                    className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 shadow-sm cursor-pointer transition-colors"
                  >
                    <svg className="mr-1 h-3.5 w-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Assign members
                  </button>

                  {showAssigneeSelect && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowAssigneeSelect(false)}
                      />
                      <div className="absolute left-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 p-2 z-20 text-xs font-medium">
                        <div className="font-bold text-gray-500 px-2 pb-1.5 border-b border-gray-100 mb-1">
                          Select members
                        </div>
                        <div className="space-y-0.5 max-h-48 overflow-y-auto">
                          {AVAILABLE_ASSIGNEES.map((member) => {
                            const isSelected = currentAssignees.some((a) => a.name === member.name);
                            return (
                              <button
                                type="button"
                                key={member.name}
                                onClick={() => {
                                  let nextAssignees = [...currentAssignees];
                                  if (isSelected) {
                                    nextAssignees = nextAssignees.filter((a) => a.name !== member.name);
                                  } else {
                                    nextAssignees.push({ name: member.name, avatar: member.avatar });
                                  }
                                  setValue('assignees', nextAssignees, { shouldDirty: true, shouldValidate: true });
                                }}
                                className="w-full flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-gray-50 text-gray-700 transition-colors cursor-pointer"
                              >
                                <div className="flex items-center gap-2">
                                  <img src={member.avatar} alt={member.name} className="h-5.5 w-5.5 rounded-full object-cover" />
                                  <span className="truncate">{member.name}</span>
                                </div>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {}} // Driven purely by button click
                                  className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
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

            {/* Priority Option Cards */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Priority
              </label>
              <div className="flex flex-wrap gap-3">
                {priorityOptions.map((priority) => (
                  <label
                    key={priority}
                    className="flex items-center border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer select-none"
                  >
                    <input
                      type="radio"
                      value={priority}
                      {...register('priority')}
                      className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="ml-2 text-xs font-semibold text-gray-700 uppercase tracking-wide">{priority}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Dates (Start date & Due date) */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">Start date</label>
                <input
                  type="date"
                  {...register('startDate')}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">Due date</label>
                <input
                  type="date"
                  {...register('dueDate')}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
              </div>
            </div>
          </div>
        </div>

        {isEditMode && taskData && (
          <div className="mt-8 border-t border-gray-200 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Activity Log ({activities.length})
              </h4>
            </div>

            {isLoadingActivities ? (
              <div className="py-4 text-center text-xs text-gray-500 italic">
                Loading activity logs...
              </div>
            ) : activities.length > 0 ? (
              <div className="max-h-60 overflow-y-auto pr-2 space-y-4">
                <div className="flow-root">
                  <ul className="-mb-8">
                    {activities.map((activity, index) => {
                      const isLast = index === activities.length - 1;
                      let relativeTime = '';
                      try {
                        relativeTime = formatDistanceToNow(parseISO(activity.created_at), { addSuffix: true });
                      } catch {
                        relativeTime = 'just now';
                      }

                      return (
                        <li key={activity.id}>
                          <div className="relative pb-6">
                            {!isLast && (
                              <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true" />
                            )}
                            <div className="relative flex space-x-3 items-start">
                              <div>
                                <img
                                  className="h-8 w-8 rounded-full bg-gray-400 flex items-center justify-center ring-4 ring-white object-cover"
                                  src={activity.actor.avatar}
                                  alt={activity.actor.name}
                                />
                              </div>
                              <div className="flex-1 min-w-0 pt-1.5">
                                <p className="text-xs text-gray-600">
                                  <span className="font-bold text-gray-900">{activity.actor.name}</span>{' '}
                                  <span className="text-gray-500">{activity.details.description}</span>
                                </p>
                                <div className="text-[10px] text-gray-400 mt-0.5">
                                  {relativeTime}
                                </div>
                              </div>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 py-6 text-center text-xs text-gray-400 italic">
                No activity logged for this task yet.
              </div>
            )}
          </div>
        )}
      </form>
    </ContentDialog>
  );
}

export default TaskDialog;
