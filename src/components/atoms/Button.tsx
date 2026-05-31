import React from 'react'

interface ButtonProps {
  text: string,
  icon?: React.ReactNode,
  className?: string,
  variant?: 'primary' | 'secondary' | 'outline' | 'text',
  size?: 'sm' | 'md' | 'lg'
  onClick?: () => void,
  type?: 'button' | 'submit',
  disabled?: boolean,
}

// Shared base: every variant gets a consistent focus-visible ring, smooth color
// transition, and a uniform disabled treatment (no pointer + reduced opacity).
const baseClasses =
  'inline-flex items-center justify-center cursor-pointer transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-60';

function Button({
  text,
  icon,
  className,
  onClick,
  type = 'button',
  variant = 'primary',
  size = 'sm',
  disabled = false,
}: ButtonProps) {

  const variantClasses = {
    primary: 'text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus-visible:ring-blue-200',
    secondary: 'text-body bg-neutral-secondary-medium box-border border border-default-medium hover:bg-neutral-tertiary-medium hover:text-heading focus-visible:ring-neutral-tertiary shadow-xs font-medium leading-5 rounded-base text-sm px-4 py-2.5',
    text: 'text-heading bg-transparent box-border border border-transparent hover:bg-neutral-secondary-medium focus-visible:ring-neutral-tertiary font-medium leading-5 rounded-base text-sm px-4 py-2.5',
    outline: 'text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus-visible:ring-slate-200'
  }

  const sizeClasses = {
    'sm': 'px-4 py-2',
    'md': 'px-5 py-3',
    'lg': 'px-6 py-4',
  }

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className ?? ''}`}
      onClick={onClick}
      type={type}
      disabled={disabled}
    >
      {icon}
      {text}
    </button>
  )
}

export default Button
