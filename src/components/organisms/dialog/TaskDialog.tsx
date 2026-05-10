import { useEffect } from 'react';
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
import type { ITaskItem } from '../../../types/task.type';

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
}).required();

const priorityOptions: Array<NonNullable<ITaskItem['priority']>> = ['High', 'Medium', 'Low', 'Lowest'];
interface TaskDialogValues {
  title: string;
  description?: string;
  priority?: string;
  startDate?: string;
  dueDate?: string;
}

function TaskDialog({ isOpen, onClose, onSubmitTask, taskData }: TaskDialogProps) {
  const isEditMode = Boolean(taskData);

  const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm<TaskDialogValues>({
    resolver: yupResolver(taskSchema) as Resolver<TaskDialogValues>,
    defaultValues: {
      title: taskData?.title || '',
      description: taskData?.description || '',
      priority: taskData?.priority || 'Low',
      startDate: taskData?.startDate || '',
      dueDate: taskData?.dueDate || '',
    }
  });

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
    };

    reset(nextValues);
    setValue('description', nextValues.description);

    if (editor) {
      editor.commands.setContent(nextValues.description);
    }
  }, [editor, isOpen, reset, setValue, taskData]);

  if (!isOpen) return null;

  const handleFormSubmit = (formData: TaskDialogValues) => {
    onSubmitTask({
      title: formData.title,
      description: formData.description || '',
      priority: formData.priority as TaskDialogFormData['priority'],
      startDate: formData.startDate || '',
      dueDate: formData.dueDate || '',
    });
  };

  return (
    <ContentDialog
      onSubmit={handleSubmit(handleFormSubmit)}
      onClose={onClose}
      title={(
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-gray-900">
            {isEditMode ? 'Edit task' : 'Add new task'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
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
          <div className="flex flex-col space-y-4">
            <InputField
              label="Title"
              messageError={errors.title?.message}
              placeholder="Add title here"
              {...register('title')}
            />

            <div className="flex flex-1 flex-col">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Description
              </label>

              <div className="flex items-center space-x-2 rounded-t-md border border-gray-300 border-b-0 bg-gray-50 px-2 py-1">
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

              <div className="min-h-[160px] flex-1 overflow-hidden rounded-b-md border border-gray-300 bg-white">
                <EditorContent editor={editor} className="w-full" />
              </div>

              {errors.description && (
                <span className="mt-2 text-sm text-red-500">{errors.description.message}</span>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Assignee & Communication
              </label>
              <div className="mb-3 flex items-center space-x-3">
                <div className="flex -space-x-2">
                  <img
                    src="https://flowbite.com/application-ui/demo/images/users/bonnie-green.png"
                    alt="User"
                    className="h-8 w-8 rounded-full border-2 border-white"
                  />
                  <img
                    src="https://flowbite.com/application-ui/demo/images/users/roberta-casas.png"
                    alt="User"
                    className="h-8 w-8 rounded-full border-2 border-white"
                  />
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-gray-100 text-xs text-gray-700">
                    +9
                  </div>
                </div>
                <button type="button" className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
                  <svg className="mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add member
                </button>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Priority
              </label>
              <div className="flex flex-wrap gap-3">
                {priorityOptions.map((priority) => (
                  <label key={priority} className="flex items-center">
                    <input
                      type="radio"
                      value={priority}
                      {...register('priority')}
                      className="h-4 w-4 border-gray-300 bg-white text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">{priority}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Start date</label>
                <input
                  type="date"
                  {...register('startDate')}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Due date</label>
                <input
                  type="date"
                  {...register('dueDate')}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>
      </form>
    </ContentDialog>
  );
}

export default TaskDialog;
