'use client';

import { useState } from 'react';
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

interface MembersDataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchPlaceholder?: string;
}

export function MembersDataTable<TData, TValue>({
  columns,
  data,
  searchPlaceholder = 'Filter members...',
}: MembersDataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: 'includesString',
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
  });

  return (
    <div className='flex flex-col gap-3'>
      <div className='relative'>
        <Search className='text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2' />
        <Input
          placeholder={searchPlaceholder}
          value={globalFilter}
          onChange={e => setGlobalFilter(e.target.value)}
          className='h-8 pl-8 text-xs'
        />
      </div>

      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <TableHead
                    key={header.id}
                    className='h-8 px-3 text-xs'
                    style={
                      header.column.columnDef.size
                        ? { width: header.column.columnDef.size }
                        : undefined
                    }
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map(row => (
                <TableRow
                  key={row.id}
                  className='hover:bg-muted/50 transition-colors'
                >
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id} className='px-3 py-2'>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className='h-24 text-center'
                >
                  <span className='text-muted-foreground text-sm'>
                    No results.
                  </span>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className='text-muted-foreground text-xs'>
        {table.getFilteredRowModel().rows.length} of {data.length}{' '}
        {data.length === 1 ? 'row' : 'rows'}
      </div>
    </div>
  );
}
