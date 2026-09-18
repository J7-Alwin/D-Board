import React from 'react';
import type { AttachmentDTO } from '../../api/files.api';
import { ImageViewer } from './viewers/ImageViewer';
import { PdfViewer } from './viewers/PdfViewer';
import { SpreadsheetViewer } from './viewers/SpreadsheetViewer';
import { DocumentViewer } from './viewers/DocumentViewer';
import { PresentationViewer } from './viewers/PresentationViewer';
import { CodeViewer } from './viewers/CodeViewer';
import { DataViewer } from './viewers/DataViewer';
import { MarkdownViewer } from './viewers/MarkdownViewer';
import { ArchiveViewer } from './viewers/ArchiveViewer';
import { GenericFileViewer } from './viewers/GenericFileViewer';

interface ViewerResolverProps {
  file: AttachmentDTO;
}

export const ViewerResolver: React.FC<ViewerResolverProps> = ({ file }) => {
  const ext = (file.extension || '').toLowerCase();
  const cat = file.category;

  // 1. Image formats
  if (cat === 'IMAGE' || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'].includes(ext)) {
    return <ImageViewer file={file} />;
  }

  // 2. PDF
  if (cat === 'PDF' || ext === 'pdf') {
    return <PdfViewer file={file} />;
  }

  // 3. Spreadsheets (XLSX, XLS, CSV, TSV)
  if (cat === 'SPREADSHEET' || ['xlsx', 'xls', 'csv', 'tsv', 'ods'].includes(ext)) {
    return <SpreadsheetViewer file={file} />;
  }

  // 4. Presentations (PPTX, PPT)
  if (cat === 'PRESENTATION' || ['pptx', 'ppt', 'odp'].includes(ext)) {
    return <PresentationViewer file={file} />;
  }

  // 5. Word Documents (DOCX, DOC, RTF)
  if (cat === 'DOCUMENT' && ['docx', 'doc', 'rtf', 'odt'].includes(ext)) {
    return <DocumentViewer file={file} />;
  }

  // 6. Markdown
  if (ext === 'md' || ext === 'markdown') {
    return <MarkdownViewer file={file} />;
  }

  // 7. Structured Data (JSON, YAML, XML)
  if (cat === 'DATA' || ['json', 'yaml', 'yml', 'xml', 'toml'].includes(ext)) {
    return <DataViewer file={file} />;
  }

  // 8. Code & Developer Scripts
  if (
    cat === 'CODE' ||
    ['js', 'jsx', 'ts', 'tsx', 'html', 'htm', 'css', 'scss', 'sql', 'py', 'java', 'c', 'cpp', 'h', 'cs', 'go', 'rs', 'php', 'rb', 'sh', 'bat'].includes(ext)
  ) {
    return <CodeViewer file={file} />;
  }

  // 9. Plain Text
  if (cat === 'TEXT' || ['txt', 'log', 'env', 'ini', 'conf'].includes(ext)) {
    return <CodeViewer file={file} />;
  }

  // 10. Archives (ZIP)
  if (cat === 'ARCHIVE' || ['zip'].includes(ext)) {
    return <ArchiveViewer file={file} />;
  }

  // 11. Generic File Fallback
  return <GenericFileViewer file={file} />;
};
