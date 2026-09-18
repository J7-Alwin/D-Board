import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import type { AttachmentDTO } from '../../../api/files.api';
import { filesApi } from '../../../api/files.api';
import { SearchIcon, ChevronLeftIcon, ChevronRightIcon, TableIcon, DownloadIcon } from '../../ui/Icons';
import { Button } from '../../ui/Button';

interface SpreadsheetViewerProps {
  file: AttachmentDTO;
}

export const SpreadsheetViewer: React.FC<SpreadsheetViewerProps> = ({ file }) => {
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [activeSheetName, setActiveSheetName] = useState<string>('');
  const [sheetData, setSheetData] = useState<any[][]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination & search state
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 100;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setSearchQuery('');
    setCurrentPage(1);

    filesApi
      .fetchFileArrayBuffer(file.projectId, file.id)
      .then((buffer) => {
        if (!active) return;
        try {
          const wb = XLSX.read(buffer, { type: 'array', cellDates: true, dense: true });
          if (!wb.SheetNames || wb.SheetNames.length === 0) {
            throw new Error('No sheets found in workbook');
          }
          setWorkbook(wb);
          const firstSheet = wb.SheetNames[0];
          setActiveSheetName(firstSheet);
          loadSheetData(wb, firstSheet);
        } catch (err: any) {
          throw new Error(err.message || 'Failed to parse spreadsheet file');
        }
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || 'Failed to load spreadsheet');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [file.projectId, file.id]);

  const loadSheetData = (wb: XLSX.WorkBook, sheetName: string) => {
    const ws = wb.Sheets[sheetName];
    if (!ws) {
      setSheetData([]);
      return;
    }
    // Parse sheet to array of arrays (rows)
    const rawRows = XLSX.utils.sheet_to_json<any[]>(ws, {
      header: 1,
      defval: '',
      blankrows: false,
    });
    setSheetData(rawRows);
    setCurrentPage(1);
  };

  const handleSheetChange = (sheetName: string) => {
    if (!workbook || sheetName === activeSheetName) return;
    setActiveSheetName(sheetName);
    loadSheetData(workbook, sheetName);
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

  if (error || !workbook) {
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
      {workbook.SheetNames.length > 1 && (
        <div className="spreadsheet-sheet-tabs">
          {workbook.SheetNames.map((name) => (
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
