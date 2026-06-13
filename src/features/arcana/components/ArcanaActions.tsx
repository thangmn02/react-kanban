interface ArcanaActionsProps {
  children: React.ReactNode;
  align?: 'center' | 'between';
}

export function ArcanaActions({ children, align = 'center' }: ArcanaActionsProps) {
  return (
    <div className={`arcana-actions ${align === 'between' ? 'arcana-actions--between' : ''}`}>
      {children}
    </div>
  );
}

interface ArcanaButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'quiet';
  disabled?: boolean;
  ariaLabel?: string;
}

export function ArcanaButton({
  children,
  onClick,
  variant = 'primary',
  disabled = false,
  ariaLabel,
}: ArcanaButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`arcana-action arcana-action--${variant}`}
    >
      {children}
    </button>
  );
}
