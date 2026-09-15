/**
 * DataTable — consistent table with loading skeleton, error, empty state and
 * a pagination footer. Horizontal scroll on small screens.
 */
import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button, EmptyState, ErrorState, TableSkeleton } from './primitives';
import type { PageMeta } from '../../lib/types';

export interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
}

export function DataTable<T extends { id: number }>({
  columns,
  rows,
  loading,
  error,
  onRetry,
  emptyTitle = 'Nothing here yet',
  emptyDescription,
  emptyIcon,
  emptyAction,
  rowActions,
  meta,
  onPageChange,
  keyField = 'id',
}: {
  columns: Column<T>[];
  rows: T[] | null;
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: LucideIcon;
  emptyAction?: ReactNode;
  rowActions?: (row: T) => ReactNode;
  meta?: PageMeta | null;
  onPageChange?: (page: number) => void;
  keyField?: string;
}) {
  const hasActions = Boolean(rowActions);
  return (
    <div className="rj-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr className="bg-zinc-950/40">
              {columns.map((c) => (
                <th key={c.key} className={`rj-th ${c.headerClassName ?? ''}`}>
                  {c.label}
                </th>
              ))}
              {hasActions && <th className="rj-th w-px text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading && rows === null ? null : null}
          </tbody>
        </table>
        {loading && rows === null && <TableSkeleton cols={columns.length + (hasActions ? 1 : 0)} />}
        {!loading && error && <ErrorState message={error} onRetry={onRetry} />}
        {!loading && !error && rows && rows.length === 0 && (
          <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} action={emptyAction} />
        )}
        {!loading && !error && rows && rows.length > 0 && (
          <table className="w-full min-w-[640px] border-collapse">
            <tbody>
              {rows.map((row) => (
                <tr key={String((row as any)[keyField])} className="rj-tr">
                  {columns.map((c) => (
                    <td key={c.key} className={`rj-td ${c.className ?? ''}`}>
                      {c.render ? c.render(row) : String((row as any)[c.key] ?? '—')}
                    </td>
                  ))}
                  {hasActions && (
                    <td className="rj-td whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">{rowActions!(row)}</div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {meta && onPageChange && rows && rows.length > 0 && (
        <div className="flex flex-col items-center justify-between gap-3 border-t border-white/5 px-4 py-3 sm:flex-row">
          <p className="text-xs text-zinc-500">
            Showing{' '}
            <span className="text-zinc-300">
              {(meta.page - 1) * meta.perPage + 1}–{Math.min(meta.page * meta.perPage, meta.total)}
            </span>{' '}
            of <span className="text-zinc-300">{meta.total}</span>
          </p>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" disabled={meta.page <= 1} onClick={() => onPageChange(meta.page - 1)} aria-label="Previous page">
              <ChevronLeft size={15} />
            </Button>
            <span className="px-2 text-xs text-zinc-400">
              Page {meta.page} / {meta.totalPages}
            </span>
            <Button
              size="icon"
              variant="ghost"
              disabled={meta.page >= meta.totalPages}
              onClick={() => onPageChange(meta.page + 1)}
              aria-label="Next page"
            >
              <ChevronRight size={15} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Toolbar with search + filter selects. */
export function ListToolbar({
  search,
  onSearch,
  searchPlaceholder,
  filters,
  children,
}: {
  search: string;
  onSearch: (value: string) => void;
  searchPlaceholder?: string;
  filters?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={searchPlaceholder ?? 'Search…'}
            className="rj-input pl-9"
            aria-label="Search"
          />
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
        </div>
        {filters}
      </div>
      {children}
    </div>
  );
}
