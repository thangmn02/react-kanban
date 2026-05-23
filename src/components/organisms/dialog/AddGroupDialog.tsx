import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { useForm } from 'react-hook-form';

import Button from '../../atoms/Button';
import ContentDialog from '../../molecules/dialog/ContentDialog';
import InputField from '../../molecules/InputField';

interface AddGroupDialogValues {
  title: string;
}

interface AddGroupDialogProps {
  onClose: () => void;
  onSubmitGroup: (formData: AddGroupDialogValues) => void;
}

const listSchema = yup.object({
  title: yup.string().required('Title is required'),
}).required();

function AddGroupDialog({ onClose, onSubmitGroup }: AddGroupDialogProps) {
  const { 
    register: registerList, 
    handleSubmit: handleSubmitList, 
    formState: { errors: errorsList }, 
    reset: resetList 
    } = useForm<AddGroupDialogValues>({
      resolver: yupResolver(listSchema)
    });

  const onSubmit = (formData: AddGroupDialogValues) => {
    onSubmitGroup(formData);
    resetList();
  };

  return (
    <ContentDialog
      title={(
        <h3 className="text-xl font-semibold text-gray-900 mb-6">Add new group</h3>
      )}
      onSubmit={() => {}}
      onClose={onClose}
      textButtonClose='Cancel'
      textButtonSubmit='+ Add new group'
      modalFooter={<></>}
    >
      <form onSubmit={handleSubmitList(onSubmit)}>
        <InputField 
          label="Name"
          messageError={errorsList.title?.message || ''}
          {...registerList('title')}
        />

        <div className="flex space-x-3">
          <Button 
            text='+ Add new group'
            variant='primary'
            type="submit"
          />
          <Button 
            text='Cancel'
            variant='outline'
            onClick={onClose}
          />
        </div>      
      </form>
    </ContentDialog>
  );
}

export default AddGroupDialog;
