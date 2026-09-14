export interface Column<T> {
  header: string;
  cell: (row: T) => React.ReactNode;
  numeric?: boolean;
}

// Una tabla de reporte: filas, pie de totales y un aviso si no hay datos.
export function ReportTable<T>({ rows, columns, totals, testId, rowTestId, empty }: { rows: T[]; columns: Column<T>[]; totals?: React.ReactNode[]; testId: string; rowTestId: (row: T, index: number) => string; empty: string }) {
  return (
    <div className="border-line overflow-x-auto rounded-lg border">
      <table className="w-full text-sm" data-testid={testId}>
        <thead className="bg-surface text-muted text-left text-xs uppercase tracking-wide">
          <tr>
            {columns.map((column) => (
              <th key={column.header} className={`px-4 py-2 font-medium ${column.numeric ? 'text-right' : ''}`}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={rowTestId(row, index)} className="border-line border-t" data-testid={rowTestId(row, index)}>
              {columns.map((column) => (
                <td key={column.header} className={`px-4 py-3 ${column.numeric ? 'text-right' : ''}`}>
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="text-muted px-4 py-6 text-center" data-testid={`${testId}-empty`}>
                {empty}
              </td>
            </tr>
          ) : totals ? (
            <tr className="border-line bg-surface border-t font-medium" data-testid={`${testId}-totals`}>
              {totals.map((cell, index) => (
                <td key={index} className={`px-4 py-3 ${columns[index]?.numeric ? 'text-right' : ''}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
