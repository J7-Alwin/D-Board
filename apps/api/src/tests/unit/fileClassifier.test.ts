import { describe, it, expect } from 'vitest';
import { classifyFile, sanitizeFilename } from '../../utils/fileClassifier.js';

describe('File Classifier & Sanitizer Unit Tests', () => {
  it('should correctly classify file extensions into categories', () => {
    expect(classifyFile('photo.png').category).toBe('IMAGE');
    expect(classifyFile('manual.pdf').category).toBe('PDF');
    expect(classifyFile('data.xlsx').category).toBe('SPREADSHEET');
    expect(classifyFile('report.docx').category).toBe('DOCUMENT');
    expect(classifyFile('source.ts').category).toBe('CODE');
    expect(classifyFile('backup.zip').category).toBe('ARCHIVE');
    expect(classifyFile('unknown.xyz').category).toBe('OTHER');
  });

  it('should sanitize unsafe filenames and prevent path traversal', () => {
    expect(sanitizeFilename('../../../etc/passwd')).not.toContain('..');
    expect(sanitizeFilename('../../secrets.txt')).toBe('secrets.txt');
    expect(sanitizeFilename('invalid:name*file?.txt')).not.toMatch(/[:*?]/);
    expect(sanitizeFilename('normal-file_name.pdf')).toBe('normal-file_name.pdf');
  });
});
