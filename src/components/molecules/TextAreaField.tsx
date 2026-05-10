import type { TextareaHTMLAttributes } from 'react';

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  messageError?: string;
}

function TextAreaField({ label, messageError, ...props }: TextAreaFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
      <textarea
        placeholder="Please input ..."
        rows={5}
        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        {...props}
      />
      {messageError && (
        <span className="text-red-500 text-sm">{messageError}</span>
      )}
    </div>
  )
}

export default TextAreaField
