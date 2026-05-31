import type React from 'react';
import ContentDialog from '../../molecules/dialog/ContentDialog'


interface DeleteDialogProps extends React.PropsWithChildren {
  onSubmit: () => void;
  onClose?: () => void;
}

function DeleteDialog({ 
  onSubmit, 
  onClose, 
  children = 'Are you sure you want to delete this item?'
}: DeleteDialogProps) {
  return (
    <ContentDialog
      textButtonClose='No, cancel'
      textButtonSubmit="Yes, I'm sure"
      onSubmit={onSubmit}
      onClose={onClose}
    >
      <div className="flex justify-center mb-4">
        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
          <svg className="w-6 h-6 text-gray-600" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </div>
      </div>

      <p className="text-center text-gray-700 mb-6">
        {children}
      </p>
    </ContentDialog>
  )
}

export default DeleteDialog