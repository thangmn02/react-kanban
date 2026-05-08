import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { useForm } from 'react-hook-form';

import Button from '../../atoms/Button'
import ContentDialog from '../../molecules/dialog/ContentDialog'
import InputField from '../../molecules/InputField'
import TextAreaField from '../../molecules/TextAreaField'

interface AddGroupDialogProps {
  onClose: () => void;
  onSubmitGroup: (formData: any) => void;
}

const listSchema = yup.object({
  title: yup.string().required('Title is required'),
  description: yup.string()
}).required();

function AddGroupDialog({ onClose, onSubmitGroup }: AddGroupDialogProps) {
  const { 
    register: registerList, 
    handleSubmit: handleSubmitList, 
    formState: { errors: errorsList }, 
    reset: resetList 
    } = useForm({
      resolver: yupResolver(listSchema)
    });

  const onSubmit = (formData: any) => {
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
        
        <br />

        <TextAreaField 
          label="Description"
          messageError={errorsList.description?.message || ''}
          {...registerList('description')}
        />

        <div className="flex space-x-3">
          <Button 
            text='+ Add new group'
            variant='primary'
            type="submit"
            onClick={() => {}}
          />
          <Button 
            text='Cancel'
            variant='outline'
            onClick={onClose}
          />
        </div>      
      </form>
    </ContentDialog>
  )
}

export default AddGroupDialog