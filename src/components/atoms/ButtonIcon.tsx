import React from 'react'

interface ButtonIconProps {
  icon: React.ReactNode,
  /** Required: icon-only controls must expose an accessible name. */
  label: string,
  className?: string,
  onClick?: () => void,
  type?: 'button' | 'submit',
  disabled?: boolean,
  title?: string,
}

// Reusable accessible icon-only button. Enforces an aria-label (icon-only
// controls have no visible text), and ships consistent cursor / hover / focus /
// disabled affordances so every icon control is keyboard- and pointer-discoverable.
function ButtonIcon({
  icon,
  label,
  className = 'text-gray-400 hover:text-gray-600',
  onClick,
  type = 'button',
  disabled = false,
  title,
}: ButtonIconProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={title ?? label}
      className={`inline-flex items-center justify-center cursor-pointer rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {icon}
    </button>
  )
}

export default ButtonIcon
