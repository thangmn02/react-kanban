import React from 'react';
import Button from '../../atoms/Button';

interface ContentDialogProps extends React.PropsWithChildren {
  title?: React.ReactNode;
  textButtonClose?: string;
  textButtonSubmit?: string;
  modalFooter?: React.ReactNode;
  className?: string;
  /** Classes for the fixed backdrop/scrim. Defaults to the legacy flat gray. */
  scrimClassName?: string;
  onSubmit: () => void;
  onClose?: () => void;
}

function ContentDialog({
  title,
  textButtonClose = 'Close',
  textButtonSubmit = 'Ok',
  children,
  onSubmit,
  onClose,
  modalFooter,
  className = "max-w-md w-full p-6",
  scrimClassName = 'bg-gray-900 opacity-50',
}: ContentDialogProps) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div
        className={`fixed inset-0 transition-opacity ${scrimClassName}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="flex min-h-screen items-center justify-center p-4">
        <div
          className={`relative bg-white rounded-lg shadow-xl ${className}`}
          role="dialog"
          aria-modal="true"
        >
          {/* modal header */}
          {title}

          {/* modal body */}
          <div>
            {children}
          </div>

          {/* modal footer */}
          {modalFooter || (
            <div className="flex justify-center space-x-3">
              {textButtonClose && (
                <Button
                  text={textButtonClose}
                  variant='outline'
                  onClick={onClose}
                />
              )}

              {textButtonSubmit && (
                <Button
                  text={textButtonSubmit}
                  variant='primary'
                  onClick={onSubmit}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ContentDialog