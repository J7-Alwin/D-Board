import React, { useState, useEffect } from 'react';
import type { AttachmentDTO } from '../../../api/files.api';
import { filesApi } from '../../../api/files.api';
import { CopyIcon, CheckIcon, SearchIcon, DatabaseIcon, DownloadIcon } from '../../ui/Icons';
import { Button } from '../../ui/Button';

interface DataViewerProps {
  file: AttachmentDTO;
}

export const DataViewer: React.FC<DataViewerProps> = ({ file }) => {
  const [rawText, setRawText] = useState<string>('');
  const [parsedJson, setParsedJson] = useState<any>(null);
  const [isJson, setIsJson] = useState(false);
  const [viewMode, setViewMode] = useState<'tree' | 'raw'>('tree');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setSearchQuery('');

    filesApi
      .fetchFileText(file.projectId, file.id)
      .then((text) => {
        if (!active) return;
        setRawText(text);

        if (file.extension === 'json' || file.mimeType.includes('json')) {
          try {
            const parsed = JSON.parse(text);
            setParsedJson(parsed);
            setIsJson(true);
            setViewMode('tree');
          } catch {
            setIsJson(false);
            setViewMode('raw');
          }
        } else {
          setIsJson(false);
          setViewMode('raw');
        }
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || 'Failed to load data content');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [file.projectId, file.id, file.extension, file.mimeType]);

  const handleCopy = () => {
    navigator.clipboard.writeText(rawText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) {
    return (
      <div className="viewer-loading-state">
        <div className="btn-spinner" />
        <p>Parsing structured data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="viewer-error-state">
        <DatabaseIcon size={40} className="viewer-error-icon" />
        <h3>Unable to load data file</h3>
        <p className="text-secondary">{error}</p>
        <a href={filesApi.getFileDownloadUrl(file.projectId, file.id)} download={file.originalName}>
          <Button variant="primary" size="sm" leftIcon={<DownloadIcon size={14} />}>
            Download Data
          </Button>
        </a>
      </div>
    );
  }

  return (
    <div className="data-viewer-container">
      {/* Top Toolbar */}
      <div className="data-viewer-toolbar">
        <div className="data-toolbar-left">
          <span className="data-type-badge">{file.extension.toUpperCase()}</span>
          {isJson && (
            <div className="data-mode-toggles">
              <button
                type="button"
                className={`data-mode-btn ${viewMode === 'tree' ? 'active' : ''}`}
                onClick={() => setViewMode('tree')}
              >
                Tree View
              </button>
              <button
                type="button"
                className={`data-mode-btn ${viewMode === 'raw' ? 'active' : ''}`}
                onClick={() => setViewMode('raw')}
              >
                Formatted JSON
              </button>
            </div>
          )}
        </div>

        <div className="data-toolbar-search">
          <SearchIcon size={14} />
          <input
            type="text"
            placeholder="Search data..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="data-search-input"
          />
        </div>

        <div className="data-toolbar-right">
          <button type="button" className="data-copy-btn" onClick={handleCopy}>
            {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Main View */}
      <div className="data-surface-wrapper">
        {isJson && viewMode === 'tree' ? (
          <div className="json-tree-container">
            <JsonNode name="root" value={parsedJson} searchQuery={searchQuery} depth={0} isRoot />
          </div>
        ) : (
          <pre className="data-raw-pre">
            <code>{rawText}</code>
          </pre>
        )}
      </div>
    </div>
  );
};

interface JsonNodeProps {
  name: string;
  value: any;
  searchQuery: string;
  depth: number;
  isRoot?: boolean;
}

const JsonNode: React.FC<JsonNodeProps> = ({ name, value, searchQuery, depth, isRoot }) => {
  const [collapsed, setCollapsed] = useState(depth > 2);

  const isObject = value !== null && typeof value === 'object' && !Array.isArray(value);
  const isArray = Array.isArray(value);
  const isExpandable = isObject || isArray;

  const matchesSearch =
    searchQuery &&
    (name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (!isExpandable && String(value).toLowerCase().includes(searchQuery.toLowerCase())));

  if (!isExpandable) {
    let displayVal = JSON.stringify(value);
    let valClass = 'json-val-string';
    if (typeof value === 'number') valClass = 'json-val-number';
    if (typeof value === 'boolean') valClass = 'json-val-boolean';
    if (value === null) valClass = 'json-val-null';

    return (
      <div className={`json-node-row ${matchesSearch ? 'node-highlight' : ''}`} style={{ paddingLeft: `${depth * 16}px` }}>
        {!isRoot && <span className="json-key">{name}: </span>}
        <span className={`json-val ${valClass}`}>{displayVal}</span>
      </div>
    );
  }

  const count = isArray ? value.length : Object.keys(value).length;

  return (
    <div className="json-expandable-node">
      <div
        className={`json-node-row expandable-row ${matchesSearch ? 'node-highlight' : ''}`}
        style={{ paddingLeft: `${depth * 16}px` }}
        onClick={() => setCollapsed(!collapsed)}
      >
        <span className="json-toggle-arrow">{collapsed ? '▶' : '▼'}</span>
        {!isRoot && <span className="json-key">{name}: </span>}
        <span className="json-type-hint">
          {isArray ? `Array[${count}]` : `{${count} keys}`}
        </span>
      </div>

      {!collapsed && (
        <div className="json-children-block">
          {isArray
            ? value.map((item: any, idx: number) => (
                <JsonNode
                  key={idx}
                  name={String(idx)}
                  value={item}
                  searchQuery={searchQuery}
                  depth={depth + 1}
                />
              ))
            : Object.entries(value).map(([k, v]) => (
                <JsonNode
                  key={k}
                  name={k}
                  value={v}
                  searchQuery={searchQuery}
                  depth={depth + 1}
                />
              ))}
        </div>
      )}
    </div>
  );
};
