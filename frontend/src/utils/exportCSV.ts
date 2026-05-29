/**
 * Exports an array of objects as a CSV file download.
 * @param data - Array of objects to export
 * @param filename - Name of the downloaded file (without .csv)
 * @param headers - Optional map of { key: 'Column Label' } to control column order/names
 */
export function exportToCSV<T extends Record<string, any>>(
  data: T[],
  filename: string,
  headers?: Record<string, string>
) {
  if (data.length === 0) return;

  const keys = headers ? Object.keys(headers) : Object.keys(data[0]);
  const labels = headers ? Object.values(headers) : keys;

  const escape = (val: any): string => {
    if (val === null || val === undefined) return '';
    const str = String(val).replace(/"/g, '""');
    return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str}"` : str;
  };

  const rows = [
    labels.join(','),
    ...data.map(row => keys.map(k => escape(row[k])).join(','))
  ];

  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
