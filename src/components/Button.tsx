import React from 'react'

interface ButtonProps {
  text: string,
  icon?: React.ReactNode,
  className?: string,
  variant?: 'primary' | 'secondary' | 'outline' | 'text',
  size?: 'sm' | 'md' | 'lg'
  onClick?: () => void,
  type?: 'button' | 'submit'
} 

function Button({ 
  text, 
  icon, 
  className,
  onClick,
  type = 'button',
  variant = 'primary',
  size = 'sm'
}: ButtonProps) {

  const variantClasses = {
    primary: 'inline-flex items-center text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700',
    secondary: 'text-body bg-neutral-secondary-medium box-border border border-default-medium hover:bg-neutral-tertiary-medium hover:text-heading focus:ring-4 focus:ring-neutral-tertiary shadow-xs font-medium leading-5 rounded-base text-sm px-4 py-2.5 focus:outline-none',
    text: 'text-heading bg-transparent box-border border border-transparent hover:bg-neutral-secondary-medium focus:ring-4 focus:ring-neutral-tertiary font-medium leading-5 rounded-base text-sm px-4 py-2.5 focus:outline-none',
    outline: 'text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50'
  }

  const sizeClasses = {
    'sm': 'px-4 py-2',
    'md': 'px-5 py-3',
    'lg': 'px-6 py-4',
  }

  return (
    <button 
      className={`cursor-pointer ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      onClick={onClick}
      type={type}
    >
      {icon}
      {text}
    </button>
  )
}

export default Button