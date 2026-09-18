import React, { useState, useEffect, useMemo } from 'react';
import type { AttachmentDTO } from '../../../api/files.api';
import { filesApi } from '../../../api/files.api';
import { SearchIcon, CheckIcon, CopyIcon, CodeIcon, DownloadIcon } from '../../ui/Icons';
import { Button } from '../../ui/Button';

interface CodeViewerProps {
  file: AttachmentDTO;
}

export const CodeViewer: React.FC<CodeViewerProps> = ({ file }) => {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [wrapLines, setWrapLines] = useState(false);
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
        setContent(text);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || 'Failed to load code content');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [file.projectId, file.id]);

  const lines = useMemo(() => {
    return content.split(/\r?\n/);
  }, [content]);

  const handleCopy = () => {
    if (!content) return;
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const matchingLineIndices = useMemo(() => {
    if (!searchQuery.trim()) return new Set<number>();
    const q = searchQuery.toLowerCase();
    const set = new Set<number>();
    lines.forEach((line, idx) => {
      if (line.toLowerCase().includes(q)) {
        set.add(idx);
      }
    });
    return set;
  }, [lines, searchQuery]);

  if (loading) {
    return (
      <div className="viewer-loading-state">
        <div className="btn-spinner" />
        <p>Loading code file...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="viewer-error-state">
        <CodeIcon size={40} className="viewer-error-icon" />
        <h3>Unable to load code</h3>
        <p className="text-secondary">{error}</p>
        <a href={filesApi.getFileDownloadUrl(file.projectId, file.id)} download={file.originalName}>
          <Button variant="primary" size="sm" leftIcon={<DownloadIcon size={14} />}>
            Download Code
          </Button>
        </a>
      </div>
    );
  }

  return (
    <div className="code-viewer-container">
      {/* Code Viewer Toolbar */}
      <div className="code-viewer-toolbar">
        <div className="code-toolbar-left">
          <span className="code-lang-badge">{file.extension.toUpperCase()}</span>
          <span className="code-stats-tag">{lines.length} lines</span>
          <span className="code-stats-tag">{(file.sizeBytes / 1024).toFixed(1)} KB</span>
        </div>

        <div className="code-toolbar-search">
          <SearchIcon size={14} />
          <input
            type="text"
            placeholder="Search code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="code-search-input"
          />
          {searchQuery && (
            <span className="code-match-count">{matchingLineIndices.size} match(es)</span>
          )}
        </div>

        <div className="code-toolbar-actions">
          <button
            type="button"
            className={`code-toolbar-toggle ${wrapLines ? 'active' : ''}`}
            onClick={() => setWrapLines(!wrapLines)}
            title="Toggle word wrap"
          >
            Wrap
          </button>
          <button
            type="button"
            className="code-copy-btn"
            onClick={handleCopy}
            title="Copy code to clipboard"
          >
            {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Code Editor Surface */}
      <div className={`code-surface-wrapper ${wrapLines ? 'wrap-enabled' : ''}`}>
        <table className="code-editor-table">
          <tbody>
            {lines.map((line, idx) => {
              const isMatch = matchingLineIndices.has(idx);
              return (
                <tr key={idx} className={`code-line-row ${isMatch ? 'line-matched' : ''}`}>
                  <td className="code-line-number">{idx + 1}</td>
                  <td className="code-line-content">
                    <code>{line || ' '}</code>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
