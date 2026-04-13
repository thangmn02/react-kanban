interface ButtonIconProps {
  icon: React.ReactNode,
  className?: string
}

function ButtonIcon({ icon, className = "text-gray-400 hover:text-gray-600" }: ButtonIconProps) {
  return (
    <button className={className}>
      {icon}
    </button>
  )
}

export default ButtonIcon