import { useId, type InputHTMLAttributes } from 'react';
import { useI18n } from '../../i18n';

interface InputFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  messageError?: string;
}

function InputField({ label, messageError, ...props }: InputFieldProps) {
  const { t } = useI18n();
  const generatedId=useId();
  const id=props.id||generatedId;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
      <input
        type="text"
        placeholder={t('app.pleaseInput')}
        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        {...props}
        id={id}
      />
      {messageError && (
        <span className="text-red-500 text-sm">{messageError}</span>
      )}
    </div>
  )
}

export default InputField
