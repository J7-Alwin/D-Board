import React, { useState, useEffect, useMemo } from 'react';
import JSZip from 'jszip';
import type { AttachmentDTO } from '../../../api/files.api';
import { filesApi } from '../../../api/files.api';
import {
  FolderIcon,
  FileTextIcon,
  SearchIcon,
  DownloadIcon,
  LayersIcon,
} from '../../ui/Icons';
import { Button } from '../../ui/Button';

interface ZipEntryInfo {
  path: string;
  name: string;
  isDir: boolean;
  uncompressedSize: number;
  date: Date;
}

interface ArchiveViewerProps {
  file: AttachmentDTO;
}

export const ArchiveViewer: React.FC<ArchiveViewerProps> = ({ file }) => {
  const [zipInstance, setZipInstance] = useState<JSZip | null>(null);
  const [entries, setEntries] = useState<ZipEntryInfo[]>([]);
  const [selectedEntryPath, setSelectedEntryPath] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setSelectedEntryPath(null);
    setPreviewContent(null);

    filesApi
      .fetchFileArrayBuffer(file.projectId, file.id)
      .then(async (buffer) => {
        if (!active) return;
        try {
          const zip = await JSZip.loadAsync(buffer);
          setZipInstance(zip);

          const list: ZipEntryInfo[] = [];
          zip.forEach((relativePath, zipEntry) => {
            list.push({
              path: relativePath,
              name: relativePath.split('/').filter(Boolean).pop() || relativePath,
              isDir: zipEntry.dir,
              uncompressedSize: (zipEntry as any)._data?.uncompressedSize || 0,
              date: zipEntry.date || new Date(),
            });
          });

          // Sort directories first, then alphabetically
          list.sort((a, b) => {
            if (a.isDir && !b.isDir) return -1;
            if (!a.isDir && b.isDir) return 1;
            return a.path.localeCompare(b.path);
          });

          setEntries(list);
        } catch (err: any) {
          throw new Error(err.message || 'Failed to inspect ZIP archive');
        }
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || 'Failed to load archive');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [file.projectId, file.id]);

  // Handle previewing entry inside ZIP
  const handleSelectEntry = async (entry: ZipEntryInfo) => {
    if (entry.isDir || !zipInstance) return;
    setSelectedEntryPath(entry.path);
    setPreviewLoading(true);
    setPreviewContent(null);

    try {
      const zipFile = zipInstance.file(entry.path);
      if (!zipFile) throw new Error('Entry not found');

      // Check if text/code
      const ext = entry.name.split('.').pop()?.toLowerCase() || '';
      const textExts = ['txt', 'md', 'json', 'js', 'ts', 'tsx', 'jsx', 'html', 'css', 'sql', 'py', 'yml', 'yaml', 'xml', 'log', 'env'];

      if (textExts.includes(ext) || entry.uncompressedSize < 100 * 1024) {
        const text = await zipFile.async('text');
        setPreviewContent(text.slice(0, 50000)); // cap preview length
      } else {
        setPreviewContent(null);
      }
    } catch (err) {
      setPreviewContent('(Unable to preview this entry)');
    } finally {
      setPreviewLoading(false);
    }
  };

  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return entries;
    const q = searchQuery.toLowerCase();
    return entries.filter((e) => e.path.toLowerCase().includes(q));
  }, [entries, searchQuery]);

  const totalUncompressedSize = useMemo(() => {
    return entries.reduce((acc, curr) => acc + curr.uncompressedSize, 0);
  }, [entries]);

  if (loading) {
    return (
      <div className="viewer-loading-state">
        <div className="btn-spinner" />
        <p>Scanning archive contents...</p>
      </div>
    );
  }

  if (error || entries.length === 0) {
    return (
      <div className="viewer-error-state">
        <LayersIcon size={40} className="viewer-error-icon" />
        <h3>Unable to inspect archive</h3>
        <p className="text-secondary">{error || 'Could not parse ZIP entries.'}</p>
        <a href={filesApi.getFileDownloadUrl(file.projectId, file.id)} download={file.originalName}>
          <Button variant="primary" size="sm" leftIcon={<DownloadIcon size={14} />}>
            Download Archive
          </Button>
        </a>
      </div>
    );
  }

  return (
    <div className="archive-viewer-container">
      {/* Archive Header Stats */}
      <div className="archive-viewer-toolbar">
        <div className="archive-stats">
          <span>{entries.length} items</span>
          <span>·</span>
          <span>{(totalUncompressedSize / (1024 * 1024)).toFixed(2)} MB uncompressed</span>
        </div>

        <div className="archive-search-box">
          <SearchIcon size={14} />
          <input
            type="text"
            placeholder="Filter archive entries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="archive-search-input"
          />
        </div>
      </div>

      {/* 2-Pane layout: Entry list on left, Entry preview on right */}
      <div className="archive-content-grid">
        <div className="archive-entries-list">
          {filteredEntries.map((entry) => (
            <div
              key={entry.path}
              className={`archive-entry-row ${entry.path === selectedEntryPath ? 'active' : ''} ${
                entry.isDir ? 'is-directory' : 'is-file'
              }`}
              onClick={() => handleSelectEntry(entry)}
            >
              <span className="entry-icon">
                {entry.isDir ? <FolderIcon size={15} /> : <FileTextIcon size={15} />}
              </span>
              <span className="entry-path-label" title={entry.path}>
                {entry.path}
              </span>
              {!entry.isDir && (
                <span className="entry-size-tag">
                  {(entry.uncompressedSize / 1024).toFixed(1)} KB
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Entry Preview Pane */}
        <div className="archive-preview-pane">
          {selectedEntryPath ? (
            <div className="entry-preview-card">
              <div className="entry-preview-header">
                <span className="entry-preview-name">{selectedEntryPath}</span>
              </div>
              {previewLoading ? (
                <div className="preview-loading-box">
                  <div className="btn-spinner" />
                  <p>Reading entry...</p>
                </div>
              ) : previewContent != null ? (
                <pre className="entry-preview-pre">
                  <code>{previewContent}</code>
                </pre>
              ) : (
                <div className="entry-no-preview">
                  <p>Binary entry. Download the full archive to inspect.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="archive-empty-preview">
              <p>Select any file from the archive to inspect its contents.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
