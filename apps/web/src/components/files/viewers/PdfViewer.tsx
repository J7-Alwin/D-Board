import React, { useState, useEffect } from 'react';
import type { AttachmentDTO } from '../../../api/files.api';
import { filesApi } from '../../../api/files.api';
import { DownloadIcon, FileTextIcon, MaximizeIcon } from '../../ui/Icons';
import { Button } from '../../ui/Button';

interface PdfViewerProps {
  file: AttachmentDTO;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({ file }) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let url: string | null = null;
    setLoading(true);
    setError(null);

    filesApi
      .fetchFileBlob(file.projectId, file.id)
      .then((blob) => {
        if (!active) return;
        url = URL.createObjectURL(blob);
        setBlobUrl(url);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || 'Failed to load PDF');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [file.projectId, file.id]);

  if (loading) {
    return (
      <div className="viewer-loading-state">
        <div className="btn-spinner" />
        <p>Loading PDF document...</p>
      </div>
    );
  }

  if (error || !blobUrl) {
    return (
      <div className="viewer-error-state">
        <FileTextIcon size={40} className="viewer-error-icon" />
        <h3>Unable to render PDF</h3>
        <p className="text-secondary">{error || 'Your browser could not preview this PDF.'}</p>
        <a href={filesApi.getFileDownloadUrl(file.projectId, file.id)} download={file.originalName}>
          <Button variant="primary" size="sm" leftIcon={<DownloadIcon size={14} />}>
            Download PDF
          </Button>
        </a>
      </div>
    );
  }

  return (
    <div className="pdf-viewer-container">
      <div className="pdf-viewer-header">
        <span className="pdf-viewer-title">{file.originalName}</span>
        <div className="pdf-viewer-actions">
          <a
            href={blobUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="viewer-action-link"
            title="Open in new tab"
          >
            <Button variant="outline" size="sm" leftIcon={<MaximizeIcon size={14} />}>
              Open Full
            </Button>
          </a>
        </div>
      </div>
      <div className="pdf-frame-wrapper">
        <iframe
          src={`${blobUrl}#toolbar=1&navpanes=1&scrollbar=1`}
          title={file.originalName}
          className="pdf-iframe-element"
        />
      </div>
    </div>
  );
};
