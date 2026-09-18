import React from 'react';
import type { AttachmentDTO } from '../../../api/files.api';
import { filesApi } from '../../../api/files.api';
import { FolderIcon, DownloadIcon, ClockIcon, UserIcon, LayersIcon } from '../../ui/Icons';
import { Button } from '../../ui/Button';

interface GenericFileViewerProps {
  file: AttachmentDTO;
}

export const GenericFileViewer: React.FC<GenericFileViewerProps> = ({ file }) => {
  const formattedSize =
    file.sizeBytes < 1024
      ? `${file.sizeBytes} B`
      : file.sizeBytes < 1024 * 1024
      ? `${(file.sizeBytes / 1024).toFixed(1)} KB`
      : `${(file.sizeBytes / (1024 * 1024)).toFixed(2)} MB`;

  return (
    <div className="generic-viewer-container">
      <div className="generic-card-box">
        <div className="generic-icon-circle">
          <FolderIcon size={48} />
        </div>

        <h3 className="generic-filename">{file.originalName}</h3>
        <span className="generic-category-badge">{file.category}</span>

        <p className="generic-notice-text">
          Preview is not supported for this binary format. You can inspect its properties or download the original file.
        </p>

        <a href={filesApi.getFileDownloadUrl(file.projectId, file.id)} download={file.originalName}>
          <Button variant="primary" size="md" leftIcon={<DownloadIcon size={16} />}>
            Download ({formattedSize})
          </Button>
        </a>

        {/* File Properties Table */}
        <div className="generic-meta-table">
          <div className="generic-meta-row">
            <span className="meta-row-label">
              <LayersIcon size={14} /> Extension
            </span>
            <span className="meta-row-value">.{file.extension}</span>
          </div>
          <div className="generic-meta-row">
            <span className="meta-row-label">MIME Type</span>
            <span className="meta-row-value">{file.mimeType}</span>
          </div>
          <div className="generic-meta-row">
            <span className="meta-row-label">Exact Size</span>
            <span className="meta-row-value">{file.sizeBytes.toLocaleString()} bytes</span>
          </div>
          <div className="generic-meta-row">
            <span className="meta-row-label">
              <UserIcon size={14} /> Uploaded By
            </span>
            <span className="meta-row-value">
              {file.uploadedBy?.fullName || file.uploadedBy?.username || 'Unknown'}
            </span>
          </div>
          <div className="generic-meta-row">
            <span className="meta-row-label">
              <ClockIcon size={14} /> Uploaded On
            </span>
            <span className="meta-row-value">
              {new Date(file.createdAt).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
          {file.checksum && (
            <div className="generic-meta-row">
              <span className="meta-row-label">SHA-256 Checksum</span>
              <span className="meta-row-value font-mono text-xs" title={file.checksum}>
                {file.checksum.slice(0, 16)}...
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
