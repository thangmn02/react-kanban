import { useForm, useWatch, type Resolver } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';

import Button from '../../atoms/Button';
import ContentDialog from '../../molecules/dialog/ContentDialog';
import InputField from '../../molecules/InputField';
import TextAreaField from '../../molecules/TextAreaField';
import { BOARD_TEMPLATES, DEFAULT_BOARD_TEMPLATE_ID } from '../../../data/boardTemplates';

interface CreateBoardDialogProps {
  onClose: () => void;
  onSubmitBoard: (formData: CreateBoardDialogValues) => void;
}

interface CreateBoardDialogValues {
  title: string;
  description: string;
  templateId: string;
}

const createBoardSchema = yup.object({
  title: yup.string().required('Board title is required'),
  description: yup.string(),
  templateId: yup.string().required(),
}).required();

function CreateBoardDialog({ onClose, onSubmitBoard }: CreateBoardDialogProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    control,
  } = useForm<CreateBoardDialogValues>({
    resolver: yupResolver(createBoardSchema) as Resolver<CreateBoardDialogValues>,
    defaultValues: {
      title: '',
      description: '',
      templateId: DEFAULT_BOARD_TEMPLATE_ID,
    },
  });

  const selectedTemplateId = useWatch({ control, name: 'templateId' });

  const onSubmit = (formData: CreateBoardDialogValues) => {
    onSubmitBoard(formData);
    reset();
  };

  return (
    <ContentDialog
      title={(
        <div className="mb-6">
          <h3 className="text-xl font-semibold text-gray-900">Create new board</h3>
          <p className="mt-1 text-sm text-gray-500">
            Start from a lightweight template instead of an empty board.
          </p>
        </div>
      )}
      onSubmit={() => {}}
      onClose={onClose}
      modalFooter={<></>}
      className="max-w-2xl w-full p-6"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <InputField
          label="Board title"
          messageError={errors.title?.message || ''}
          placeholder="Frontend System Upgrade"
          {...register('title')}
        />

        <TextAreaField
          label="Board description"
          messageError={errors.description?.message || ''}
          placeholder="Short context for this board"
          {...register('description')}
        />

        <div>
          <label className="mb-3 block text-sm font-semibold text-gray-700">
            Template
          </label>
          <div className="grid gap-3 md:grid-cols-3">
            {BOARD_TEMPLATES.map((template) => {
              const isSelected = selectedTemplateId === template.id;

              return (
                <label
                  key={template.id}
                  className={`cursor-pointer rounded-xl border p-4 transition-colors ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 shadow-sm'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    value={template.id}
                    {...register('templateId')}
                    className="sr-only"
                  />
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{template.name}</p>
                      <p className="mt-1 text-xs text-gray-500">{template.description}</p>
                    </div>
                    {isSelected && (
                      <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {template.lists.map((listTitle) => (
                      <span
                        key={listTitle}
                        className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-medium text-gray-600 border border-gray-200"
                      >
                        {listTitle}
                      </span>
                    ))}
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button text="Create board" variant="primary" type="submit" />
          <Button text="Cancel" variant="outline" onClick={onClose} />
        </div>
      </form>
    </ContentDialog>
  );
}

export default CreateBoardDialog;
