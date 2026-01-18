'use client';

import { Filter, ArrowUpDown } from 'lucide-react';

/**
 * SessionFilterBar Component
 * 
 * Filter and sort controls for the session list.
 * Requirements: 6.1, 6.2
 */

export type StatusFilter = 'all' | 'active' | 'completed';
export type SortOption = 'newest' | 'oldest' | 'completeness';

export interface SessionFilterBarProps {
  statusFilter: StatusFilter;
  sortBy: SortOption;
  onStatusFilterChange: (status: StatusFilter) => void;
  onSortChange: (sort: SortOption) => void;
  sessionCount?: number;
}

const statusOptions: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All Sessions' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
];

const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'completeness', label: 'By Progress' },
];

export function SessionFilterBar({
  statusFilter,
  sortBy,
  onStatusFilterChange,
  onSortChange,
  sessionCount,
}: SessionFilterBarProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        {/* Status Filter */}
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <Filter className="w-4 h-4 text-slate-400" />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value as StatusFilter)}
            className="pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 appearance-none cursor-pointer hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Sort Dropdown */}
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <ArrowUpDown className="w-4 h-4 text-slate-400" />
          </div>
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
            className="pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 appearance-none cursor-pointer hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Session Count */}
      {sessionCount !== undefined && (
        <div className="text-sm text-slate-500">
          {sessionCount} {sessionCount === 1 ? 'session' : 'sessions'}
        </div>
      )}
    </div>
  );
}

export default SessionFilterBar;
