import React from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Pagination, PaginationProps } from './Pagination';

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  render?: (item: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
  sortable?: boolean;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;
  className?: string;
  keyExtractor?: (item: T, index: number) => string | number;
  pagination?: PaginationProps;
  toolbar?: React.ReactNode;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (columnKey: string) => void;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  isLoading = false,
  emptyMessage = 'No records found.',
  onRowClick,
  className,
  keyExtractor = (item, idx) => item.id ?? idx,
  pagination,
  toolbar,
  sortColumn,
  sortDirection = 'desc',
  onSort,
}: DataTableProps<T>) {
  return (
    <div className={cn('w-full rounded-2xl border border-slate-100 bg-white shadow-card overflow-hidden', className)}>
      {toolbar && (
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          {toolbar}
        </div>
      )}

      <div className="w-full overflow-x-auto">
        <table className="w-full text-left text-[15px] border-collapse">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-100 text-[14px] font-bold text-slate-600 uppercase tracking-wider">
              {columns.map((col) => {
                const isSorted = sortColumn === col.key;
                return (
                  <th
                    key={col.key}
                    className={cn(
                      'py-3.5 px-4',
                      col.sortable && onSort ? 'cursor-pointer select-none hover:bg-slate-100/80 transition-colors' : '',
                      col.headerClassName
                    )}
                    onClick={() => {
                      if (col.sortable && onSort) {
                        onSort(col.key);
                      }
                    }}
                    tabIndex={col.sortable && onSort ? 0 : undefined}
                    role={col.sortable && onSort ? 'button' : undefined}
                    aria-sort={col.sortable && isSorted ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}
                    onKeyDown={(e) => {
                      if (col.sortable && onSort && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        onSort(col.key);
                      }
                    }}
                  >
                    <div className="inline-flex items-center gap-1.5">
                      <span>{col.header}</span>
                      {col.sortable && onSort && (
                        <span className="text-slate-400">
                          {isSorted ? (
                            sortDirection === 'asc' ? (
                              <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
                            ) : (
                              <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3.5 h-3.5 text-slate-300 hover:text-slate-500" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {isLoading ? (
              // Skeleton loader rows
              Array.from({ length: 5 }).map((_, rIdx) => (
                <tr key={rIdx} className="animate-pulse">
                  {columns.map((col, cIdx) => (
                    <td key={cIdx} className="py-4 px-4">
                      <div className="h-4 bg-slate-100 rounded-md w-3/4" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center text-slate-400">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((item, idx) => (
                <tr
                  key={keyExtractor(item, idx)}
                  onClick={() => onRowClick && onRowClick(item)}
                  className={cn(
                    'transition-colors duration-150',
                    onRowClick ? 'hover:bg-blue-50/40 cursor-pointer' : 'hover:bg-slate-50/60'
                  )}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={cn('py-3.5 px-4', col.className)}>
                      {col.render ? col.render(item) : item[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination && (
        <div className="border-t border-slate-100 bg-slate-50/30">
          <Pagination {...pagination} />
        </div>
      )}
    </div>
  );
}
