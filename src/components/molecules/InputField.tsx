interface InputFieldProps {
  label: string;
  messageError?: string;
}

function InputField({ label, messageError, ...props }: InputFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
      <input
        type="text"
        placeholder="Please input ..."
        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        {...props}
      />
      {messageError && (
        <span className="text-red-500 text-sm">{messageError}</span>
      )}
    </div>
  )
}

export default InputField