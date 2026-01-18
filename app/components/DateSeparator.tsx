import { formatDateLabel } from '../lib/date-utils';

export interface DateSeparatorProps {
  date: Date;
  className?: string;
}

/**
 * DateSeparator component displays a visual separator between messages from different dates
 * Shows a centered date label with horizontal divider lines on both sides
 */
export function DateSeparator({ date, className = '' }: DateSeparatorProps): JSX.Element {
  return (
    <div className={`flex items-center gap-3 my-4 ${className}`}>
      <div className="flex-1 h-px bg-slate-200" />
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-2">
        {formatDateLabel(date)}
      </span>
      <div className="flex-1 h-px bg-slate-200" />
    </div>
  );
}
