import * as XLSX from 'xlsx';

export interface WorkerParseRequest {
  buffer: ArrayBuffer;
  maxSheets?: number;
  maxRows?: number;
}

export interface SheetResult {
  rows: any[][];
  truncated: boolean;
  totalRowCount: number;
}

export interface WorkerParseResponse {
  success: boolean;
  sheetNames?: string[];
  sheetsData?: Record<string, SheetResult>;
  totalSheets?: number;
  error?: string;
}

self.onmessage = (e: MessageEvent<WorkerParseRequest>) => {
  try {
    const { buffer, maxSheets = 20, maxRows = 5000 } = e.data;

    // Hardened parser options: disable VBA macros and external workbook formula resolution
    const wb = XLSX.read(buffer, {
      type: 'array',
      cellDates: true,
      dense: true,
      bookVBA: false,
      bookDeps: false,
    });

    if (!wb.SheetNames || wb.SheetNames.length === 0) {
      throw new Error('No sheets found in workbook');
    }

    const totalSheets = wb.SheetNames.length;
    const sheetNames = wb.SheetNames.slice(0, maxSheets);
    const sheetsData: Record<string, SheetResult> = {};

    for (const name of sheetNames) {
      const ws = wb.Sheets[name];
      if (!ws) {
        sheetsData[name] = { rows: [], truncated: false, totalRowCount: 0 };
        continue;
      }

      const rawRows = XLSX.utils.sheet_to_json<any[]>(ws, {
        header: 1,
        defval: '',
        blankrows: false,
      });

      const totalRowCount = rawRows.length;
      const isTruncated = totalRowCount > maxRows;
      const rows = isTruncated ? rawRows.slice(0, maxRows) : rawRows;

      sheetsData[name] = {
        rows,
        truncated: isTruncated,
        totalRowCount,
      };
    }

    const response: WorkerParseResponse = {
      success: true,
      sheetNames,
      sheetsData,
      totalSheets,
    };

    self.postMessage(response);
  } catch (err: any) {
    const response: WorkerParseResponse = {
      success: false,
      error: err.message || 'Failed to parse spreadsheet file',
    };
    self.postMessage(response);
  }
};
