import { getDueDateStatus } from '../../utils/taskMetadata';

interface DueDateBadgeProps {
  dueDate?: string;
  isDone?: boolean;
  className?: string;
}

export default function DueDateBadge({ dueDate, isDone, className = '' }: DueDateBadgeProps) {
  const meta = getDueDateStatus(dueDate, isDone);

  // Render different SVGs depending on iconName
  const renderIcon = () => {
    switch (meta.iconName) {
      case 'alert':
        return (
          <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
      case 'clock':
        return (
          <svg className="h-3.5 w-3.5 shrink-0 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'calendar':
      default:
        return (
          <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        );
    }
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded px-2.5 py-0.5 text-xs transition-colors duration-150 ${meta.className} ${className}`}
      title={dueDate ? `Due date: ${dueDate}` : 'No due date set'}
    >
      {renderIcon()}
      <span>{meta.label}</span>
    </span>
  );
}
