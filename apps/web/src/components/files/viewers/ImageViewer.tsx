import React, { useState, useEffect } from 'react';
import type { AttachmentDTO } from '../../../api/files.api';
import { filesApi } from '../../../api/files.api';
import { DownloadIcon } from '../../ui/Icons';
import { Button } from '../../ui/Button';

interface ImageViewerProps {
  file: AttachmentDTO;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({ file }) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let url: string | null = null;
    setLoading(true);
    setError(null);
    setZoom(1);
    setRotation(0);

    filesApi
      .fetchFileBlob(file.projectId, file.id)
      .then((blob) => {
        if (!active) return;
        url = URL.createObjectURL(blob);
        setBlobUrl(url);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || 'Failed to load image');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [file.projectId, file.id]);

  const handleZoomIn = () => setZoom((z) => Math.min(Number((z + 0.25).toFixed(2)), 4));
  const handleZoomOut = () => setZoom((z) => Math.max(Number((z - 0.25).toFixed(2)), 0.25));
  const handleRotate = () => setRotation((r) => (r + 90) % 360);
  const handleFit = () => {
    setZoom(1);
    setRotation(0);
  };

  if (loading) {
    return (
      <div className="viewer-loading-state">
        <div className="btn-spinner" />
        <p>Loading image...</p>
      </div>
    );
  }

  if (error || !blobUrl) {
    return (
      <div className="viewer-error-state">
        <p className="text-danger">{error || 'Unable to display image'}</p>
        <a href={filesApi.getFileDownloadUrl(file.projectId, file.id)} download={file.originalName}>
          <Button variant="outline" size="sm" leftIcon={<DownloadIcon size={14} />}>
            Download Image
          </Button>
        </a>
      </div>
    );
  }

  return (
    <div className="image-viewer-container">
      {/* Floating Toolbar matching reference design */}
      <div className="image-viewer-floating-dock">
        <button
          type="button"
          className="dock-tool-btn"
          onClick={handleZoomOut}
          title="Zoom Out"
          aria-label="Zoom Out"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            <line x1="8" y1="11" x2="14" y2="11"></line>
          </svg>
        </button>

        <span className="dock-zoom-indicator">{Math.round(zoom * 100)}%</span>

        <button
          type="button"
          className="dock-tool-btn"
          onClick={handleZoomIn}
          title="Zoom In"
          aria-label="Zoom In"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            <line x1="11" y1="8" x2="11" y2="14"></line>
            <line x1="8" y1="11" x2="14" y2="11"></line>
          </svg>
        </button>

        <div className="dock-tool-divider" />

        <button
          type="button"
          className="dock-tool-btn"
          onClick={handleRotate}
          title="Rotate 90°"
          aria-label="Rotate"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"></polyline>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
          </svg>
        </button>

        <button
          type="button"
          className="dock-tool-btn dock-fit-btn"
          onClick={handleFit}
          title="Fit to Screen"
        >
          Fit
        </button>
      </div>

      {/* Image Canvas */}
      <div className="image-canvas-viewport">
        <img
          src={blobUrl}
          alt={file.originalName}
          className="image-viewer-render-target"
          style={{
            transform: `scale(${zoom}) rotate(${rotation}deg)`,
            transition: 'transform 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
      </div>
    </div>
  );
};
