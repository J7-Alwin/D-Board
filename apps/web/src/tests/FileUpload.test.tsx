import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { filesApi, type AttachmentDTO } from '../api/files.api';
import { FileUploadModal } from '../components/files/FileUploadModal';

describe('File Upload Flow & Contract Parsing Unit Tests', () => {
  const originalXHR = window.XMLHttpRequest;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    window.XMLHttpRequest = originalXHR;
  });

  const mockFile = new File(['test content binary'], 'document.pdf', { type: 'application/pdf' });

  const mockAttachmentDto: AttachmentDTO = {
    id: 'att-uuid-1234',
    projectId: 'proj-uuid-5678',
    uploadedById: 'user-uuid-9999',
    workItemId: null,
    folderId: 'folder-uuid-4321',
    originalName: 'document.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 19,
    extension: 'pdf',
    category: 'PDF',
    checksum: 'sha256-dummy-hash',
    createdAt: '2026-10-08T12:00:00.000Z',
    updatedAt: '2026-10-08T12:00:00.000Z',
    uploadedBy: {
      id: 'user-uuid-9999',
      fullName: 'Alice Developer',
      username: 'alice',
      avatarUrl: null,
    },
    project: {
      id: 'proj-uuid-5678',
      name: 'Test Project',
      key: 'TEST',
    },
  };

  function mockXhrResponse(status: number, responseText: string, headers: Record<string, string> = {}) {
    class MockXHR {
      status = status;
      statusText = status === 200 || status === 201 ? 'OK' : 'Error';
      responseText = responseText;
      withCredentials = false;
      upload = {
        onprogress: null as ((e: any) => void) | null,
      };
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onabort: (() => void) | null = null;
      ontimeout: (() => void) | null = null;

      open = vi.fn((method: string, url: string) => {
        MockXHR.lastOpened = { method, url };
      });
      send = vi.fn((formData: FormData) => {
        MockXHR.lastSentFormData = formData;
        setTimeout(() => {
          if (this.onload) this.onload();
        }, 10);
      });
      getResponseHeader = vi.fn((header: string) => {
        return headers[header.toLowerCase()] || headers[header] || null;
      });

      static lastOpened = { method: '', url: '' };
      static lastSentFormData: FormData | null = null;
    }

    window.XMLHttpRequest = MockXHR as any;
    return MockXHR;
  }

  it('1. Successfully parses standard backend HTTP 201 upload response contract', async () => {
    const backendPayload = {
      success: true,
      message: '1 file(s) uploaded successfully',
      data: {
        files: [mockAttachmentDto],
      },
    };

    mockXhrResponse(201, JSON.stringify(backendPayload), { 'content-type': 'application/json' });

    const res = await filesApi.uploadFiles('proj-uuid-5678', [mockFile]);

    expect(res.success).toBe(true);
    expect(res.data.files).toHaveLength(1);
    expect(res.data.files[0].id).toBe('att-uuid-1234');
    expect(res.data.files[0].originalName).toBe('document.pdf');
    expect(res.data.files[0].category).toBe('PDF');
    expect(res.data.files[0].sizeBytes).toBe(19);
    expect(res.data.files[0].storageKey).toBeUndefined(); // Security invariant
  });

  it('2. Successfully parses backend HTTP 200 response with normalized data shape', async () => {
    const backendPayload = {
      success: true,
      data: {
        files: [mockAttachmentDto],
      },
    };

    mockXhrResponse(200, JSON.stringify(backendPayload), { 'content-type': 'application/json' });

    const res = await filesApi.uploadFiles('proj-uuid-5678', [mockFile]);

    expect(res.success).toBe(true);
    expect(res.data.files).toHaveLength(1);
    expect(res.data.files[0].id).toBe('att-uuid-1234');
  });

  it('3. Safely handles unexpected HTML / SPA redirect response without generic crash', async () => {
    const htmlResponse = '<!DOCTYPE html><html><head><title>D-Board</title></head><body><div id="root"></div></body></html>';

    mockXhrResponse(200, htmlResponse, { 'content-type': 'text/html; charset=utf-8' });

    await expect(filesApi.uploadFiles('proj-uuid-5678', [mockFile])).rejects.toThrow(
      /Upload endpoint returned HTML instead of JSON/
    );
  });

  it('4. Correctly extracts and surfaces backend API error messages on HTTP 400', async () => {
    const errorPayload = {
      success: false,
      message: 'Cannot upload files to an archived project',
      code: 'BAD_REQUEST',
    };

    mockXhrResponse(400, JSON.stringify(errorPayload), { 'content-type': 'application/json' });

    await expect(filesApi.uploadFiles('proj-uuid-5678', [mockFile])).rejects.toThrow(
      'Cannot upload files to an archived project'
    );
  });

  it('5. Correctly handles HTTP 413 payload too large non-JSON error', async () => {
    mockXhrResponse(413, '<html><body>413 Request Entity Too Large</body></html>', { 'content-type': 'text/html' });

    await expect(filesApi.uploadFiles('proj-uuid-5678', [mockFile])).rejects.toThrow(
      /Total upload size exceeds maximum allowed limit/
    );
  });

  it('6. Correctly handles empty response body', async () => {
    mockXhrResponse(200, '   ');

    await expect(filesApi.uploadFiles('proj-uuid-5678', [mockFile])).rejects.toThrow(
      /Server returned an empty response/
    );
  });

  it('7. Sends folderId and workItemId in FormData when options provided', async () => {
    const backendPayload = {
      success: true,
      data: { files: [mockAttachmentDto] },
    };

    const MockXHR = mockXhrResponse(201, JSON.stringify(backendPayload), { 'content-type': 'application/json' });

    await filesApi.uploadFiles('proj-uuid-5678', [mockFile], {
      folderId: 'folder-123',
      workItemId: 'work-456',
    });

    const formData = MockXHR.lastSentFormData;
    expect(formData).not.toBeNull();
    expect(formData?.get('folderId')).toBe('folder-123');
    expect(formData?.get('workItemId')).toBe('work-456');
  });

  it('8. FileUploadModal displays uploaded files upon successful parsing', async () => {
    const onUploadSuccess = vi.fn();
    const onClose = vi.fn();

    vi.spyOn(filesApi, 'uploadFiles').mockResolvedValueOnce({
      success: true,
      message: 'Uploaded',
      data: {
        files: [mockAttachmentDto],
      },
    });

    render(
      <FileUploadModal
        isOpen={true}
        onClose={onClose}
        onUploadSuccess={onUploadSuccess}
        activeProjectId="proj-uuid-5678"
        projects={[{ id: 'proj-uuid-5678', name: 'Test Project', key: 'TEST', createdAt: '', updatedAt: '', createdById: '' } as any]}
      />
    );

    // Dropzone / File input
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).not.toBeNull();

    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    // Verify file is shown in selected list
    expect(screen.getByText('document.pdf')).toBeInTheDocument();

    // Click Upload Files
    const submitBtn = screen.getByRole('button', { name: /Upload Files/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onUploadSuccess).toHaveBeenCalledTimes(1);
    });

    expect(onUploadSuccess).toHaveBeenCalledWith([mockAttachmentDto], null);
    expect(onClose).toHaveBeenCalled();
  });
});
