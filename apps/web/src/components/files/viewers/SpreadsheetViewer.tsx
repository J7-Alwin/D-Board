import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { AttachmentDTO } from '../../../api/files.api';
import { filesApi } from '../../../api/files.api';
import { SearchIcon, ChevronLeftIcon, ChevronRightIcon, TableIcon, DownloadIcon } from '../../ui/Icons';
import { Button } from '../../ui/Button';
import type { WorkerParseResponse, SheetResult } from '../../../workers/spreadsheet.worker';

interface SpreadsheetViewerProps {
  file: AttachmentDTO;
}

export const SpreadsheetViewer: React.FC<SpreadsheetViewerProps> = ({ file }) => {
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [sheetsData, setSheetsData] = useState<Record<string, SheetResult>>({});
  const [activeSheetName, setActiveSheetName] = useState<string>('');
  const [sheetData, setSheetData] = useState<any[][]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination & search state
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [truncatedWarning, setTruncatedWarning] = useState<string | null>(null);
  const pageSize = 100;

  const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB limit for browser parsing
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setTruncatedWarning(null);
    setSearchQuery('');
    setCurrentPage(1);

    if (file.sizeBytes > MAX_FILE_BYTES) {
      setLoading(false);
      setError('Spreadsheet is too large to preview in full (> 10 MB). Please download the file to inspect all worksheets safely.');
      return;
    }

    // Cleanup previous worker if any
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }

    filesApi
      .fetchFileArrayBuffer(file.projectId, file.id)
      .then((buffer) => {
        if (!active) return;

        // Initialize isolated Web Worker for sandboxed parsing
        const worker = new Worker(
          new URL('../../../workers/spreadsheet.worker.ts', import.meta.url),
          { type: 'module' }
        );
        workerRef.current = worker;

        // Watchdog timeout to protect against ReDoS or excessive processing
        const watchdogTimer = setTimeout(() => {
          if (workerRef.current === worker) {
            worker.terminate();
            workerRef.current = null;
            if (active) {
              setLoading(false);
              setError('Spreadsheet parsing timed out. The file may contain complex formulas or circular structures. Please download to inspect.');
            }
          }
        }, 8000);

        worker.onmessage = (e: MessageEvent<WorkerParseResponse>) => {
          clearTimeout(watchdogTimer);
          if (!active) return;

          const data = e.data;
          if (data.success && data.sheetNames && data.sheetsData) {
            setSheetNames(data.sheetNames);
            setSheetsData(data.sheetsData);

            if (data.totalSheets && data.totalSheets > 20) {
              setTruncatedWarning(`Displaying first 20 of ${data.totalSheets} worksheets.`);
            }

            const firstSheet = data.sheetNames[0];
            setActiveSheetName(firstSheet);
            const firstSheetData = data.sheetsData[firstSheet];
            if (firstSheetData) {
              setSheetData(firstSheetData.rows);
              if (firstSheetData.truncated) {
                setTruncatedWarning((prev) =>
                  prev
                    ? `${prev} First sheet truncated to 5,000 rows (total ${firstSheetData.totalRowCount.toLocaleString()}).`
                    : `Displaying first 5,000 rows (sheet contains ${firstSheetData.totalRowCount.toLocaleString()} rows). Download file to view all.`
                );
              }
            }
            setLoading(false);
          } else {
            setLoading(false);
            setError(data.error || 'Failed to parse spreadsheet in isolated sandbox');
          }
        };

        worker.onerror = () => {
          clearTimeout(watchdogTimer);
          if (!active) return;
          setLoading(false);
          setError('An isolated sandbox error occurred while parsing the spreadsheet.');
        };

        // Transfer buffer to worker
        worker.postMessage({ buffer, maxSheets: 20, maxRows: 5000 }, [buffer]);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || 'Failed to load spreadsheet');
        setLoading(false);
      });

    return () => {
      active = false;
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [file.projectId, file.id, file.sizeBytes]);

  const handleSheetChange = (sheetName: string) => {
    if (sheetName === activeSheetName) return;
    setActiveSheetName(sheetName);
    const target = sheetsData[sheetName];
    if (target) {
      setSheetData(target.rows);
      if (target.truncated) {
        setTruncatedWarning(`Displaying first 5,000 rows (sheet contains ${target.totalRowCount.toLocaleString()} rows). Download file to view all.`);
      } else {
        setTruncatedWarning(null);
      }
    } else {
      setSheetData([]);
    }
    setCurrentPage(1);
  };

  // Filter rows based on search
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return sheetData;
    const q = searchQuery.toLowerCase().trim();
    return sheetData.filter((row) =>
      row.some((cell) => cell != null && String(cell).toLowerCase().includes(q))
    );
  }, [sheetData, searchQuery]);

  // Determine max column count
  const maxCols = useMemo(() => {
    let max = 0;
    filteredRows.forEach((r) => {
      if (r.length > max) max = r.length;
    });
    return Math.min(Math.max(max, 5), 50); // limit column span for safety
  }, [filteredRows]);

  // Paginated rows
  const totalRows = filteredRows.length;
  const totalPages = Math.ceil(totalRows / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const visibleRows = useMemo(() => {
    return filteredRows.slice(startIndex, startIndex + pageSize);
  }, [filteredRows, startIndex, pageSize]);

  // Generate column letter headers (A, B, C ... Z, AA, AB...)
  const getColHeader = (colIdx: number): string => {
    let result = '';
    let idx = colIdx;
    while (idx >= 0) {
      result = String.fromCharCode((idx % 26) + 65) + result;
      idx = Math.floor(idx / 26) - 1;
    }
    return result;
  };

  if (loading) {
    return (
      <div className="viewer-loading-state">
        <div className="btn-spinner" />
        <p>Parsing spreadsheet data...</p>
      </div>
    );
  }

  if (error || sheetNames.length === 0) {
    return (
      <div className="viewer-error-state">
        <TableIcon size={40} className="viewer-error-icon" />
        <h3>Unable to preview spreadsheet</h3>
        <p className="text-secondary">{error || 'Could not parse workbook cells.'}</p>
        <a href={filesApi.getFileDownloadUrl(file.projectId, file.id)} download={file.originalName}>
          <Button variant="primary" size="sm" leftIcon={<DownloadIcon size={14} />}>
            Download File
          </Button>
        </a>
      </div>
    );
  }

  return (
    <div className="spreadsheet-viewer-container">
      {truncatedWarning && (
        <div style={{ padding: '8px 16px', background: '#FFFBEB', color: '#B45309', borderBottom: '1px solid #FDE68A', fontSize: '13px' }}>
          ⚠️ {truncatedWarning}
        </div>
      )}
      {/* Top Controls Toolbar */}
      <div className="spreadsheet-toolbar">
        <div className="spreadsheet-search-box">
          <SearchIcon size={14} />
          <input
            type="text"
            placeholder="Search cells..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="spreadsheet-search-input"
          />
        </div>

        <div className="spreadsheet-stats">
          <span>{totalRows.toLocaleString()} rows</span>
          <span>·</span>
          <span>{maxCols} cols</span>
        </div>

        {totalPages > 1 && (
          <div className="spreadsheet-pagination">
            <button
              type="button"
              className="page-nav-btn"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
            >
              <ChevronLeftIcon size={14} />
            </button>
            <span className="page-indicator">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              className="page-nav-btn"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
            >
              <ChevronRightIcon size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Grid Canvas Table */}
      <div className="spreadsheet-table-wrapper">
        <table className="spreadsheet-grid-table">
          <thead>
            <tr>
              <th className="row-number-header">#</th>
              {Array.from({ length: maxCols }).map((_, colIdx) => (
                <th key={colIdx} className="col-header-cell">
                  {getColHeader(colIdx)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={maxCols + 1} className="spreadsheet-empty-cell">
                  {searchQuery ? 'No matching rows found.' : 'This sheet is empty.'}
                </td>
              </tr>
            ) : (
              visibleRows.map((row, rIdx) => {
                const rowNumber = startIndex + rIdx + 1;
                return (
                  <tr key={rIdx}>
                    <td className="row-number-cell">{rowNumber}</td>
                    {Array.from({ length: maxCols }).map((_, cIdx) => {
                      const cellVal = row[cIdx];
                      const formatted =
                        cellVal instanceof Date
                          ? cellVal.toLocaleDateString()
                          : cellVal != null
                          ? String(cellVal)
                          : '';

                      return (
                        <td key={cIdx} className="sheet-data-cell" title={formatted}>
                          {formatted}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Bottom Sheet Tabs */}
      {sheetNames.length > 1 && (
        <div className="spreadsheet-sheet-tabs">
          {sheetNames.map((name) => (
            <button
              key={name}
              type="button"
              className={`sheet-tab-btn ${name === activeSheetName ? 'active' : ''}`}
              onClick={() => handleSheetChange(name)}
            >
              <TableIcon size={13} />
              <span>{name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
