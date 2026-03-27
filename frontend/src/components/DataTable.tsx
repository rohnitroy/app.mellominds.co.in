import React from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  ColumnDef,
  SortingState,
} from '@tanstack/react-table';
import styles from './DataTable.module.css';

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T, any>[];
  pageSize?: number;
  emptyMessage?: string;
}

function DataTable<T>({ data, columns, pageSize = 10, emptyMessage = 'No records found' }: DataTableProps<T>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  const { pageIndex, pageSize: currentPageSize } = table.getState().pagination;
  const totalRows = data.length;
  const from = totalRows === 0 ? 0 : pageIndex * currentPageSize + 1;
  const to = Math.min((pageIndex + 1) * currentPageSize, totalRows);

  return (
    <div className={styles.wrapper}>
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
              <td colSpan={columns.length} className={styles.empty}>{emptyMessage}</td>
            </tr>
          ) : (
            table.getRowModel().rows.map(row => (
              <tr key={row.id}>
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className={styles.td}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className={styles.footer}>
        <span className={styles.footerInfo}>
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
