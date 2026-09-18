import React, { useState, useEffect } from 'react';
import mammoth from 'mammoth';
import type { AttachmentDTO } from '../../../api/files.api';
import { filesApi } from '../../../api/files.api';
import { FileTextIcon, DownloadIcon } from '../../ui/Icons';
import { Button } from '../../ui/Button';

interface DocumentViewerProps {
  file: AttachmentDTO;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({ file }) => {
  const [docHtml, setDocHtml] = useState<string | null>(null);
  const [rawText, setRawText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isDocx = file.extension === 'docx';

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setDocHtml(null);
    setRawText(null);

    if (isDocx) {
      filesApi
        .fetchFileArrayBuffer(file.projectId, file.id)
        .then(async (arrayBuffer) => {
          if (!active) return;
          try {
            const result = await mammoth.convertToHtml({ arrayBuffer });
            setDocHtml(result.value || '<p><em>(Empty document)</em></p>');
          } catch (err: any) {
            throw new Error(err.message || 'Failed to convert DOCX document');
          }
        })
        .catch((err) => {
          if (!active) return;
          setError(err.message || 'Failed to load document');
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    } else {
      // For legacy doc / rtf / txt, fetch text stream
      filesApi
        .fetchFileText(file.projectId, file.id)
        .then((text) => {
          if (!active) return;
          setRawText(text);
        })
        .catch((err) => {
          if (!active) return;
          setError(err.message || 'Failed to load document text');
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }

    return () => {
      active = false;
    };
  }, [file.projectId, file.id, isDocx]);

  if (loading) {
    return (
      <div className="viewer-loading-state">
        <div className="btn-spinner" />
        <p>Parsing document content...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="viewer-error-state">
        <FileTextIcon size={40} className="viewer-error-icon" />
        <h3>Unable to preview document</h3>
        <p className="text-secondary">{error}</p>
        <a href={filesApi.getFileDownloadUrl(file.projectId, file.id)} download={file.originalName}>
          <Button variant="primary" size="sm" leftIcon={<DownloadIcon size={14} />}>
            Download Document
          </Button>
        </a>
      </div>
    );
  }

  return (
    <div className="doc-viewer-container">
      {!isDocx && (
        <div className="doc-compat-banner">
          <span>
            ℹ️ Viewing legacy formatted text. For rich layouts and tables, modern <code>.docx</code> is recommended.
          </span>
        </div>
      )}

      <div className="doc-page-wrapper">
        <div className="doc-page-surface">
          {docHtml ? (
            <div
              className="doc-rendered-html"
              dangerouslySetInnerHTML={{ __html: docHtml }}
            />
          ) : rawText ? (
            <pre className="doc-rendered-raw">{rawText}</pre>
          ) : (
            <p className="text-secondary">No readable content found.</p>
          )}
        </div>
      </div>
    </div>
  );
};
