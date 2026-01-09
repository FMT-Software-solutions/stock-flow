import EditableLabel from '@/components/finance/reports/templates/EditableLabel';
export interface PivotRow {
  rowLabel: string;
  columns: Record<string, number>;
}

export interface PivotTableProps {
  title?: string;
  rows: PivotRow[];
  columnOrder: string[]; // ordered bucket keys
  columnLabels: Record<string, string>; // key -> label
  valueFormatter?: (n: number) => string;
  className?: string;
  style?: React.CSSProperties;
  titleKey?: string;
  onTitleSave?: (key: string, value: string) => void;
  rowHeaderLabel?: string;
}

const defaultFormat = (n: number) =>
  `GHS${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

export function PivotTable({
  title,
  rows,
  columnOrder,
  columnLabels,
  valueFormatter = defaultFormat,
  className,
  style,
  titleKey,
  onTitleSave,
  rowHeaderLabel = 'Item',
}: PivotTableProps) {
  const hasData = rows && rows.length > 0;
  const columnTotals: Record<string, number> = hasData
    ? columnOrder.reduce((acc, key) => {
        acc[key] = rows.reduce((sum, r) => sum + (r.columns[key] || 0), 0);
        return acc;
      }, {} as Record<string, number>)
    : {};
  const grandTotal = hasData
    ? columnOrder.reduce((sum, key) => sum + (columnTotals[key] || 0), 0)
    : 0;
  const PRINT_COL_LIMIT = 7;
  const chunks: string[][] = [];
  for (let i = 0; i < columnOrder.length; i += PRINT_COL_LIMIT) {
    chunks.push(columnOrder.slice(i, i + PRINT_COL_LIMIT));
  }
  const displayChunks = chunks.length <= 1 ? [columnOrder] : chunks;
  return (
    <div className={className} style={style}>
      {title ? (
        onTitleSave && titleKey ? (
          <div className="mb-2">
            <EditableLabel
              labelKey={titleKey}
              text={title}
              onSave={onTitleSave}
              className="text-lg font-semibold"
              editButtonClassName="h-7 w-7"
            />
          </div>
        ) : (
          <h3 className="text-lg font-semibold mb-2">{title}</h3>
        )
      ) : null}
      <div className="overflow-x-auto rounded-md border block print:hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="px-3 py-2 text-left font-medium" data-col="item">
                {rowHeaderLabel}
              </th>
              {columnOrder.map((key) => (
                <th
                  key={key}
                  className="px-3 py-2 text-right font-medium"
                  data-col="date"
                >
                  {columnLabels[key] || key}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-medium" data-col="total">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {hasData ? (
              rows.map((r) => {
                const total = columnOrder.reduce(
                  (sum, k) => sum + (r.columns[k] || 0),
                  0
                );
                return (
                  <tr key={r.rowLabel} className="border-t">
                    <td className="px-3 py-2 font-medium" data-col="item">
                      {r.rowLabel}
                    </td>
                    {columnOrder.map((key) => (
                      <td
                        key={key}
                        className="px-3 py-2 text-right"
                        data-col="date"
                      >
                        {valueFormatter(r.columns[key] || 0)}
                      </td>
                    ))}
                    <td
                      className="px-3 py-2 text-right font-semibold"
                      data-col="total"
                    >
                      {valueFormatter(total)}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={columnOrder.length + 2}
                  className="px-3 py-6 text-center text-muted-foreground"
                >
                  No data
                </td>
              </tr>
            )}
          </tbody>
          {hasData ? (
            <tfoot className="bg-muted print:bg-transparent text-primary">
              <tr className="border-t">
                <td className="px-3 py-2 font-medium" data-col="item">
                  Total
                </td>
                {columnOrder.map((key) => (
                  <td
                    key={key}
                    className="px-3 py-2 text-right font-semibold"
                    data-col="date"
                  >
                    {valueFormatter(columnTotals[key] || 0)}
                  </td>
                ))}
                <td className="px-3 py-2 text-right font-bold" data-col="total">
                  {valueFormatter(grandTotal)}
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
      <div className="hidden print:block space-y-2">
        {displayChunks.map((chunk, idx) => (
          <div key={idx} className="rounded-md border">
            <table className="min-w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th
                    className="px-3 py-2 text-left font-medium"
                    data-col="item"
                  >
                    {rowHeaderLabel}
                  </th>
                  {chunk.map((key) => (
                    <th
                      key={key}
                      className="px-3 py-2 text-right font-medium"
                      data-col="date"
                    >
                      {columnLabels[key] || key}
                    </th>
                  ))}
                  <th
                    className="px-3 py-2 text-right font-medium"
                    data-col="total"
                  >
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {hasData ? (
                  <>
                    {rows.map((r) => {
                      const total = columnOrder.reduce(
                        (sum, k) => sum + (r.columns[k] || 0),
                        0
                      );
                      return (
                        <tr key={r.rowLabel} className="border-t">
                          <td className="px-3 py-2 font-medium" data-col="item">
                            {r.rowLabel}
                          </td>
                          {chunk.map((key) => (
                            <td
                              key={key}
                              className="px-3 py-2 text-right"
                              data-col="date"
                            >
                              {valueFormatter(r.columns[key] || 0)}
                            </td>
                          ))}
                          <td
                            className="px-3 py-2 text-right font-semibold"
                            data-col="total"
                          >
                            {valueFormatter(total)}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="border-t bg-muted print:bg-transparent text-primary">
                      <td className="px-3 py-2 font-medium" data-col="item">
                        Total
                      </td>
                      {chunk.map((key) => (
                        <td
                          key={key}
                          className="px-3 py-2 text-right font-semibold"
                          data-col="date"
                        >
                          {valueFormatter(columnTotals[key] || 0)}
                        </td>
                      ))}
                      <td
                        className="px-3 py-2 text-right font-bold"
                        data-col="total"
                      >
                        {valueFormatter(grandTotal)}
                      </td>
                    </tr>
                  </>
                ) : (
                  <tr>
                    <td
                      colSpan={chunk.length + 2}
                      className="px-3 py-6 text-center text-muted-foreground"
                    >
                      No data
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
