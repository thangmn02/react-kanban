import { useForm, useWatch, type Resolver } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';

import Button from '../../atoms/Button';
import ContentDialog from '../../molecules/dialog/ContentDialog';
import InputField from '../../molecules/InputField';
import TextAreaField from '../../molecules/TextAreaField';
import BoardTemplatePicker from '../../board/BoardTemplatePicker';
import { DEFAULT_BOARD_TEMPLATE_ID } from '../../../data/boardTemplates';

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
    setValue,
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
          <BoardTemplatePicker
            selectedTemplateId={selectedTemplateId}
            onTemplateChange={(templateId) => setValue('templateId', templateId, {
              shouldDirty: true,
              shouldValidate: true,
            })}
          />
          <input type="hidden" {...register('templateId')} />
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
