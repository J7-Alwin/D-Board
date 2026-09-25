import React, { useState, useEffect } from 'react';
import DOMPurify from 'dompurify';
import type { AttachmentDTO } from '../../../api/files.api';
import { filesApi } from '../../../api/files.api';
import { FileTextIcon, CopyIcon, CheckIcon, DownloadIcon } from '../../ui/Icons';
import { Button } from '../../ui/Button';

interface MarkdownViewerProps {
  file: AttachmentDTO;
}

export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ file }) => {
  const [content, setContent] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'rendered' | 'source'>('rendered');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    filesApi
      .fetchFileText(file.projectId, file.id)
      .then((text) => {
        if (!active) return;
        setContent(text);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || 'Failed to load markdown');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [file.projectId, file.id]);

  const handleCopy = () => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  /**
   * Lightweight safe Markdown parser
   */
  const renderMarkdownToHtml = (md: string): string => {
    let html = md
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Code blocks ``` ... ```
    html = html.replace(/```([\s\S]*?)```/g, '<pre class="md-code-block"><code>$1</code></pre>');

    // Inline code `...`
    html = html.replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>');

    // Headings
    html = html.replace(/^### (.*$)/gim, '<h3 class="md-h3">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 class="md-h2">$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1 class="md-h1">$1</h1>');

    // Blockquotes
    html = html.replace(/^\> (.*$)/gim, '<blockquote class="md-quote">$1</blockquote>');

    // Bold & Italics
    html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');

    // Task list items
    html = html.replace(/^\- \[ \] (.*$)/gim, '<div class="md-task-item"><input type="checkbox" disabled /> $1</div>');
    html = html.replace(/^\- \[x\] (.*$)/gim, '<div class="md-task-item"><input type="checkbox" checked disabled /> $1</div>');

    // Unordered lists
    html = html.replace(/^\s*\-\s(.*$)/gim, '<li class="md-list-item">$1</li>');

    // Paragraphs
    html = html.replace(/\n\n/g, '<br/><br/>');

    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['h1', 'h2', 'h3', 'p', 'strong', 'em', 'blockquote', 'pre', 'code', 'ul', 'ol', 'li', 'br', 'div', 'input'],
      ALLOWED_ATTR: ['class', 'type', 'disabled', 'checked'],
    });
  };

  if (loading) {
    return (
      <div className="viewer-loading-state">
        <div className="btn-spinner" />
        <p>Rendering markdown document...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="viewer-error-state">
        <FileTextIcon size={40} className="viewer-error-icon" />
        <h3>Unable to preview markdown</h3>
        <p className="text-secondary">{error}</p>
        <a href={filesApi.getFileDownloadUrl(file.projectId, file.id)} download={file.originalName}>
          <Button variant="primary" size="sm" leftIcon={<DownloadIcon size={14} />}>
            Download File
          </Button>
        </a>
      </div>
    );
  }

  return (
    <div className="markdown-viewer-container">
      {/* Top Toolbar */}
      <div className="md-viewer-toolbar">
        <div className="md-tab-group">
          <button
            type="button"
            className={`md-tab-btn ${activeTab === 'rendered' ? 'active' : ''}`}
            onClick={() => setActiveTab('rendered')}
          >
            Preview
          </button>
          <button
            type="button"
            className={`md-tab-btn ${activeTab === 'source' ? 'active' : ''}`}
            onClick={() => setActiveTab('source')}
          >
            Source
          </button>
        </div>

        <button type="button" className="md-copy-btn" onClick={handleCopy}>
          {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
          <span>{copied ? 'Copied!' : 'Copy Markdown'}</span>
        </button>
      </div>

      {/* Surface Canvas */}
      <div className="md-surface-wrapper">
        {activeTab === 'rendered' ? (
          <div
            className="md-rendered-body"
            dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(content) }}
          />
        ) : (
          <pre className="md-source-pre">
            <code>{content}</code>
          </pre>
        )}
      </div>
    </div>
  );
};
