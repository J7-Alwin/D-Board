import path from 'node:path';

export type FileCategory =
  | 'IMAGE'
  | 'PDF'
  | 'DOCUMENT'
  | 'SPREADSHEET'
  | 'PRESENTATION'
  | 'TEXT'
  | 'CODE'
  | 'DATA'
  | 'ARCHIVE'
  | 'OTHER';

const EXTENSION_CATEGORY_MAP: Record<string, FileCategory> = {
  // Images
  jpg: 'IMAGE',
  jpeg: 'IMAGE',
  png: 'IMAGE',
  gif: 'IMAGE',
  webp: 'IMAGE',
  svg: 'IMAGE',
  bmp: 'IMAGE',
  ico: 'IMAGE',
  tiff: 'IMAGE',
  tif: 'IMAGE',
  avif: 'IMAGE',

  // PDF
  pdf: 'PDF',

  // Spreadsheets
  xlsx: 'SPREADSHEET',
  xls: 'SPREADSHEET',
  csv: 'SPREADSHEET',
  tsv: 'SPREADSHEET',
  ods: 'SPREADSHEET',

  // Documents
  docx: 'DOCUMENT',
  doc: 'DOCUMENT',
  rtf: 'DOCUMENT',
  odt: 'DOCUMENT',
  pages: 'DOCUMENT',

  // Presentations
  pptx: 'PRESENTATION',
  ppt: 'PRESENTATION',
  odp: 'PRESENTATION',
  key: 'PRESENTATION',

  // Text & Markdown
  txt: 'TEXT',
  log: 'TEXT',
  md: 'TEXT',
  markdown: 'TEXT',
  env: 'TEXT',
  ini: 'TEXT',
  conf: 'TEXT',
  cfg: 'TEXT',

  // Code
  js: 'CODE',
  jsx: 'CODE',
  mjs: 'CODE',
  cjs: 'CODE',
  ts: 'CODE',
  tsx: 'CODE',
  html: 'CODE',
  htm: 'CODE',
  css: 'CODE',
  scss: 'CODE',
  sass: 'CODE',
  less: 'CODE',
  sql: 'CODE',
  java: 'CODE',
  py: 'CODE',
  pyw: 'CODE',
  c: 'CODE',
  cpp: 'CODE',
  cc: 'CODE',
  cxx: 'CODE',
  h: 'CODE',
  hpp: 'CODE',
  cs: 'CODE',
  go: 'CODE',
  rs: 'CODE',
  php: 'CODE',
  rb: 'CODE',
  sh: 'CODE',
  bash: 'CODE',
  zsh: 'CODE',
  bat: 'CODE',
  cmd: 'CODE',
  ps1: 'CODE',
  swift: 'CODE',
  kt: 'CODE',
  kts: 'CODE',
  dart: 'CODE',
  lua: 'CODE',
  r: 'CODE',
  pl: 'CODE',
  scala: 'CODE',
  zig: 'CODE',
  asm: 'CODE',

  // Data
  json: 'DATA',
  xml: 'DATA',
  yaml: 'DATA',
  yml: 'DATA',
  toml: 'DATA',
  ndjson: 'DATA',
  geojson: 'DATA',

  // Archives
  zip: 'ARCHIVE',
  tar: 'ARCHIVE',
  gz: 'ARCHIVE',
  tgz: 'ARCHIVE',
  bz2: 'ARCHIVE',
  '7z': 'ARCHIVE',
  rar: 'ARCHIVE',
  xz: 'ARCHIVE',
};

const MIME_CATEGORY_MAP: Record<string, FileCategory> = {
  'image/jpeg': 'IMAGE',
  'image/png': 'IMAGE',
  'image/gif': 'IMAGE',
  'image/webp': 'IMAGE',
  'image/svg+xml': 'IMAGE',
  'image/bmp': 'IMAGE',
  'image/x-icon': 'IMAGE',
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'SPREADSHEET',
  'application/vnd.ms-excel': 'SPREADSHEET',
  'text/csv': 'SPREADSHEET',
  'text/tab-separated-values': 'SPREADSHEET',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCUMENT',
  'application/msword': 'DOCUMENT',
  'application/rtf': 'DOCUMENT',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PRESENTATION',
  'application/vnd.ms-powerpoint': 'PRESENTATION',
  'text/plain': 'TEXT',
  'text/markdown': 'TEXT',
  'application/json': 'DATA',
  'application/xml': 'DATA',
  'text/xml': 'DATA',
  'application/x-yaml': 'DATA',
  'text/yaml': 'DATA',
  'application/javascript': 'CODE',
  'text/javascript': 'CODE',
  'text/typescript': 'CODE',
  'text/html': 'CODE',
  'text/css': 'CODE',
  'application/sql': 'CODE',
  'text/x-sql': 'CODE',
  'text/x-python': 'CODE',
  'application/zip': 'ARCHIVE',
  'application/x-zip-compressed': 'ARCHIVE',
  'application/x-tar': 'ARCHIVE',
  'application/gzip': 'ARCHIVE',
  'application/x-7z-compressed': 'ARCHIVE',
  'application/x-rar-compressed': 'ARCHIVE',
};

export function classifyFile(originalName: string, mimeType?: string): {
  category: FileCategory;
  extension: string;
} {
  const rawExt = path.extname(originalName).toLowerCase().replace(/^\./, '');
  const extension = rawExt || 'bin';

  // Check extension first
  if (EXTENSION_CATEGORY_MAP[extension]) {
    return { category: EXTENSION_CATEGORY_MAP[extension], extension };
  }

  // Check MIME type
  if (mimeType && MIME_CATEGORY_MAP[mimeType.toLowerCase()]) {
    return { category: MIME_CATEGORY_MAP[mimeType.toLowerCase()], extension };
  }

  // Fallback heuristics
  if (mimeType?.startsWith('image/')) {
    return { category: 'IMAGE', extension };
  }
  if (mimeType?.startsWith('text/')) {
    return { category: 'TEXT', extension };
  }

  return { category: 'OTHER', extension };
}

/**
 * Sanitizes original filename: extracts basename, strips path characters, control codes, and leading dots.
 */
export function sanitizeFilename(name: string): string {
  if (!name || typeof name !== 'string') return 'unnamed_file';
  // First extract basename across both Windows and POSIX slashes
  const base = path.basename(name.replace(/\\/g, '/'));
  // Strip null bytes, control characters, illegal filesystem characters
  const cleaned = base
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/^\.+/, '')
    .trim();
  return cleaned.slice(0, 255) || 'unnamed_file';
}
