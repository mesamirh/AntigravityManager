import Table from 'cli-table3';
import picocolors from 'picocolors';

export interface ColumnDef {
  header: string;
  weight: number;
  minWidth?: number;
  hideOnNarrow?: boolean;
  align?: 'left' | 'center' | 'right';
}

export function createResponsiveTable(columns: ColumnDef[], rows: string[][]): string {
  const termWidth = process.stdout.columns || 100;
  const isNarrow = termWidth < 90;

  const visibleCols: ColumnDef[] = [];
  const visibleColIndices: number[] = [];

  let totalWeight = 0;
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    if (isNarrow && col.hideOnNarrow) {
      continue;
    }
    visibleCols.push(col);
    visibleColIndices.push(i);
    totalWeight += col.weight;
  }

  const bordersWidth = visibleCols.length + 1;
  const availableWidth = Math.max(10, termWidth - bordersWidth - 4);

  const colWidths = visibleCols.map((col) => {
    let w = Math.floor((col.weight / totalWeight) * availableWidth);
    if (col.minWidth && w < col.minWidth) w = col.minWidth;
    return Math.max(w, 2);
  });

  const table = new Table({
    head: visibleCols.map((c) => picocolors.bold(c.header)),
    colWidths: colWidths,
    colAligns: visibleCols.map((c) => c.align || 'left'),
    wordWrap: true,
    style: {
      head: [],
      border: ['gray']
    },
    chars: {
      top: '─',
      'top-mid': '┬',
      'top-left': '┌',
      'top-right': '┐',
      bottom: '─',
      'bottom-mid': '┴',
      'bottom-left': '└',
      'bottom-right': '┘',
      left: '│',
      'left-mid': '├',
      mid: '─',
      'mid-mid': '┼',
      right: '│',
      'right-mid': '┤',
      middle: '│'
    }
  });

  for (const row of rows) {
    const filteredRow = visibleColIndices.map((idx) => row[idx]);
    table.push(filteredRow as any);
  }

  return table.toString();
}
