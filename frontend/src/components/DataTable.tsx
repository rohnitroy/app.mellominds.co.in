import React from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  ColumnDef,
  SortingState,
  RowSelectionState,
} from '@tanstack/react-table';
import styles from './DataTable.module.css';

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T, any>[];
  pageSize?: number;
  emptyMessage?: string;
  enableSelection?: boolean;
  onSelectionChange?: (selectedRows: T[]) => void;
  onRowClick?: (row: T) => void;
}

function DataTable<T>({
  data,
  columns,
  pageSize = 10,
  emptyMessage = 'No records found',
  enableSelection = false,
  onSelectionChange,
  onRowClick,
}: DataTableProps<T>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

  // Checkbox column prepended when selection is enabled
  const selectionColumn: ColumnDef<T, any> = {
    id: '__select__',
    enableSorting: false,
    header: ({ table }) => (
      <input
        type="checkbox"
        checked={table.getIsAllPageRowsSelected()}
        ref={el => { if (el) el.indeterminate = table.getIsSomePageRowsSelected(); }}
        onChange={table.getToggleAllPageRowsSelectedHandler()}
        style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#082421' }}
      />
    ),
    cell: ({ row }) => (
      <input
        type="checkbox"
        checked={row.getIsSelected()}
        onChange={row.getToggleSelectedHandler()}
        style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#082421' }}
      />
    ),
  };

  const allColumns = enableSelection ? [selectionColumn, ...columns] : columns;

  const table = useReactTable({
    data,
    columns: allColumns,
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: (updater) => {
      const next = typeof updater === 'function' ? updater(rowSelection) : updater;
      setRowSelection(next);
      if (onSelectionChange) {
        const selected = Object.keys(next)
          .filter(k => next[k])
          .map(k => data[parseInt(k)]);
        onSelectionChange(selected);
      }
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
    enableRowSelection: enableSelection,
  });

  const { pageIndex, pageSize: currentPageSize } = table.getState().pagination;
  const totalRows = data.length;
  const from = totalRows === 0 ? 0 : pageIndex * currentPageSize + 1;
  const to = Math.min((pageIndex + 1) * currentPageSize, totalRows);

  return (
    <div className={styles.wrapper}>
      <div className={styles.tableScroll}>
      <table className={styles.table}>
        <thead className={styles.thead}>
          {table.getHeaderGroups().map(hg => (
            <tr key={hg.id}>
              {hg.headers.map(header => {
                const canSort = header.column.getCanSort();
                const sorted = header.column.getIsSorted();
                return (
                  <th
                    key={header.id}
                    className={`${styles.th} ${canSort ? styles.sortable : ''} ${sorted ? styles.sorted : ''}`}
                    onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                    style={header.id === '__select__' ? { width: '40px' } : undefined}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {canSort && (
                      <span className={styles.sortIcon}>
                        {sorted === 'asc' ? '▲' : sorted === 'desc' ? '▼' : '⇅'}
                      </span>
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody className={styles.tbody}>
          {table.getRowModel().rows.length === 0 ? (
            <tr>
              <td colSpan={allColumns.length} className={styles.empty}>{emptyMessage}</td>
            </tr>
          ) : (
            table.getRowModel().rows.map(row => (
              <tr
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                style={{
                  ...(row.getIsSelected() ? { background: '#f0faf9' } : {}),
                  ...(onRowClick ? { cursor: 'pointer' } : {}),
                }}
              >
                {row.getVisibleCells().map(cell => {
                  // Interactive cells (checkbox, actions) shouldn't trigger row navigation
                  const isInteractive = cell.column.id === '__select__' || cell.column.id === 'actions';
                  return (
                    <td
                      key={cell.id}
                      className={styles.td}
                      onClick={onRowClick && isInteractive ? (e) => e.stopPropagation() : undefined}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
      </div>

      <div className={styles.footer}>
        <span className={styles.footerInfo}>
          {enableSelection && Object.keys(rowSelection).length > 0
            ? `${Object.keys(rowSelection).filter(k => rowSelection[k]).length} selected · `
            : ''}
          Showing {from} to {to} of {totalRows} results
        </span>
        <div className={styles.pagination}>
          <img
            src="/Arrow - Left Square.svg"
            alt="Previous"
            className={`${styles.pageBtn} ${!table.getCanPreviousPage() ? styles.disabled : ''}`}
            onClick={() => table.previousPage()}
          />
          <img
            src="/Arrow - Right Square.svg"
            alt="Next"
            className={`${styles.pageBtn} ${!table.getCanNextPage() ? styles.disabled : ''}`}
            onClick={() => table.nextPage()}
          />
        </div>
      </div>
    </div>
  );
}

export default DataTable;
