import { prisma } from './prisma.js';
import { storageService } from './storage/storage.service.js';
import { LocalStorageProvider } from './storage/localStorage.provider.js';
import { fileService } from './services/file.service.js';
import { activityService } from './services/activity.service.js';
import { classifyFile, sanitizeFilename } from './utils/fileClassifier.js';
import path from 'node:path';

async function runTests() {
  console.log('🚀 Starting Files, Secure Storage & RBAC Integration Test Suite...\n');

  const timestamp = Date.now();
  const storageBase = path.resolve(process.cwd(), '..', '..', 'uploads_storage_test');
  const customProvider = new LocalStorageProvider(storageBase);

  // ----------------------------------------------------
  // TEST 1: Storage provider primitives & path traversal check
  // ----------------------------------------------------
  const testKey = `test-projects/p1/sample-${timestamp}.txt`;
  const testContent = Buffer.from('D-Board Object Storage Test Payload');

  await customProvider.upload(testKey, testContent, 'text/plain');
  const exists = await customProvider.exists(testKey);
  if (!exists) throw new Error('Uploaded object should exist in storage provider');

  const downloadedBuf = await customProvider.getBuffer(testKey);
  if (downloadedBuf.toString() !== 'D-Board Object Storage Test Payload') {
    throw new Error('Retrieved storage buffer does not match uploaded content');
  }

  // Verify path traversal rejection
  let pathTraversalBlocked = false;
  try {
    await customProvider.upload('../../etc/passwd', Buffer.from('hacked'), 'text/plain');
  } catch (err: any) {
    if (err.message.includes('Security violation')) pathTraversalBlocked = true;
  }
  if (!pathTraversalBlocked) {
    throw new Error('SECURITY VIOLATION: Path traversal was not blocked by storage provider!');
  }

  await customProvider.delete(testKey);
  const existsAfterDelete = await customProvider.exists(testKey);
  if (existsAfterDelete) throw new Error('Deleted object should not exist');
  console.log('✅ TEST 1 PASSED: Storage provider primitives & path traversal protections verified.');

  // ----------------------------------------------------
  // TEST 2: File classifier & filename sanitizer
  // ----------------------------------------------------
  if (classifyFile('sheet.xlsx').category !== 'SPREADSHEET') throw new Error('xlsx not SPREADSHEET');
  if (classifyFile('data.csv').category !== 'SPREADSHEET') throw new Error('csv not SPREADSHEET');
  if (classifyFile('doc.docx').category !== 'DOCUMENT') throw new Error('docx not DOCUMENT');
  if (classifyFile('slides.pptx').category !== 'PRESENTATION') throw new Error('pptx not PRESENTATION');
  if (classifyFile('vector.svg').category !== 'IMAGE') throw new Error('svg not IMAGE');
  if (classifyFile('manual.pdf').category !== 'PDF') throw new Error('pdf not PDF');
  if (classifyFile('archive.zip').category !== 'ARCHIVE') throw new Error('zip not ARCHIVE');
  if (classifyFile('server.ts').category !== 'CODE') throw new Error('ts not CODE');
  if (classifyFile('query.sql').category !== 'CODE') throw new Error('sql not CODE');
  if (classifyFile('config.json').category !== 'DATA') throw new Error('json not DATA');

  const sanitized = sanitizeFilename('../../../etc/evil:name?.txt');
  if (sanitized.includes('/') || sanitized.includes('\\') || sanitized.includes(':')) {
    throw new Error('Filename was not properly sanitized');
  }
  console.log('✅ TEST 2 PASSED: File classifier & filename sanitizer correctly categorize dev formats.');

  // ----------------------------------------------------
  // Database Setup: Projects & Users
  // ----------------------------------------------------
  const userAdmin = await prisma.user.create({
    data: {
      username: `file_admin_${timestamp}`,
      email: `file_admin_${timestamp}@example.com`,
      fullName: 'File Admin',
      isEmailVerified: true,
    },
  });

  const userMember = await prisma.user.create({
    data: {
      username: `file_member_${timestamp}`,
      email: `file_member_${timestamp}@example.com`,
      fullName: 'File Member',
      isEmailVerified: true,
    },
  });

  const userOutsider = await prisma.user.create({
    data: {
      username: `file_outsider_${timestamp}`,
      email: `file_outsider_${timestamp}@example.com`,
      fullName: 'File Outsider',
      isEmailVerified: true,
    },
  });

  const projectA = await prisma.project.create({
    data: {
      name: `Project Alpha ${timestamp}`,
      key: 'ALPH',
      description: 'Alpha storage workspace',
      createdById: userAdmin.id,
      members: {
        create: [
          { userId: userMember.id, role: 'PROJECT_MEMBER' },
        ],
      },
    },
  });

  const projectB = await prisma.project.create({
    data: {
      name: `Project Beta ${timestamp}`,
      key: 'BETA',
      description: 'Beta isolated workspace',
      createdById: userOutsider.id,
    },
  });

  const workItemA = await prisma.workItem.create({
    data: {
      projectId: projectA.id,
      title: 'Implement File Viewer UI',
      createdById: userAdmin.id,
    },
  });

  console.log(`✅ Test projects created:
   Project A: ${projectA.name} (${projectA.id})
   Project B: ${projectB.name} (${projectB.id})`);

  try {
    // ----------------------------------------------------
    // TEST 3: Multi-file upload with metadata persistence & storage abstraction
    // ----------------------------------------------------
    const filesToUpload = [
      {
        originalname: 'architecture.docx',
        mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: 1024,
        buffer: Buffer.from('Mock DOCX binary payload'),
      },
      {
        originalname: 'metrics.xlsx',
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: 2048,
        buffer: Buffer.from('Mock XLSX binary payload'),
      },
      {
        originalname: 'README.md',
        mimetype: 'text/markdown',
        size: 512,
        buffer: Buffer.from('# D-Board Markdown Content'),
      },
    ];

    const uploaded = await fileService.uploadFiles(projectA.id, userMember.id, filesToUpload, workItemA.id);
    if (uploaded.length !== 3) throw new Error('Expected 3 files to be created');

    const docxFile = uploaded.find((f) => f.originalName === 'architecture.docx');
    const xlsxFile = uploaded.find((f) => f.originalName === 'metrics.xlsx');
    const mdFile = uploaded.find((f) => f.originalName === 'README.md');

    if (!docxFile || docxFile.category !== 'DOCUMENT') throw new Error('DOCX category incorrect');
    if (!xlsxFile || xlsxFile.category !== 'SPREADSHEET') throw new Error('XLSX category incorrect');
    if (!mdFile || mdFile.category !== 'TEXT') throw new Error('MD category incorrect');
    if (docxFile.workItemId !== workItemA.id) throw new Error('WorkItem association failed');

    // Check physical storage existence
    const docxExists = await storageService.exists(docxFile.storageKey);
    if (!docxExists) throw new Error('DOCX file missing in object storage');

    console.log('✅ TEST 3 PASSED: Multi-file upload stored binary files & created PostgreSQL metadata.');

    // ----------------------------------------------------
    // TEST 4: Project RBAC & IDOR protection
    // ----------------------------------------------------
    // Member of Project A can list files
    const listA = await fileService.getProjectFiles(projectA.id, userMember.id, {
      category: 'ALL',
      page: 1,
      limit: 20,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
    if (listA.files.length !== 3) throw new Error('Project A member should see 3 files');

    // Outsider (userOutsider) cannot list Project A files -> 403
    let listForbidden = false;
    try {
      await fileService.getProjectFiles(projectA.id, userOutsider.id, {
        category: 'ALL',
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
    } catch (err: any) {
      if (err.statusCode === 403) listForbidden = true;
    }
    if (!listForbidden) throw new Error('SECURITY VIOLATION: Non-member was able to list Project A files!');

    // Outsider cannot get single file metadata -> 403
    let getFileForbidden = false;
    try {
      await fileService.getFileById(projectA.id, docxFile.id, userOutsider.id);
    } catch (err: any) {
      if (err.statusCode === 403) getFileForbidden = true;
    }
    if (!getFileForbidden) throw new Error('SECURITY VIOLATION: Non-member was able to get file metadata!');

    // Outsider cannot get file stream / download -> 403
    let streamForbidden = false;
    try {
      await fileService.getFileStream(projectA.id, docxFile.id, userOutsider.id);
    } catch (err: any) {
      if (err.statusCode === 403) streamForbidden = true;
    }
    if (!streamForbidden) throw new Error('SECURITY VIOLATION: Non-member was able to stream file content!');

    console.log('✅ TEST 4 PASSED: RBAC & IDOR protections prevent unauthorized file access.');

    // ----------------------------------------------------
    // TEST 5: Global files aggregator across accessible projects
    // ----------------------------------------------------
    // Member has access to Project A -> returns 3 files
    const globalMember = await fileService.getGlobalFiles(userMember.id, {
      category: 'ALL',
      page: 1,
      limit: 20,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
    if (globalMember.files.length !== 3) throw new Error('Global files query for member should return 3 files');

    // Outsider has access only to Project B (0 files) -> returns 0
    const globalOutsider = await fileService.getGlobalFiles(userOutsider.id, {
      category: 'ALL',
      page: 1,
      limit: 20,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
    if (globalOutsider.files.length !== 0) throw new Error('Global files query for outsider should return 0 files');
    console.log('✅ TEST 5 PASSED: Global files aggregator returns strictly authorized files.');

    // ----------------------------------------------------
    // TEST 6: Rename file & activity logging
    // ----------------------------------------------------
    const renamed = await fileService.renameFile(projectA.id, docxFile.id, userMember.id, 'system-architecture-v2.docx');
    if (renamed.originalName !== 'system-architecture-v2.docx') {
      throw new Error('File originalName was not renamed');
    }
    if (renamed.storageKey !== docxFile.storageKey) {
      throw new Error('Storage key should remain unchanged during display rename');
    }

    // Outsider cannot rename -> 403
    let renameForbidden = false;
    try {
      await fileService.renameFile(projectA.id, docxFile.id, userOutsider.id, 'hacked.docx');
    } catch (err: any) {
      if (err.statusCode === 403) renameForbidden = true;
    }
    if (!renameForbidden) throw new Error('SECURITY VIOLATION: Non-member was able to rename file!');

    console.log('✅ TEST 6 PASSED: Display rename updates originalName without mutating storageKey.');

    // ----------------------------------------------------
    // TEST 7: Delete file & physical storage cleanup
    // ----------------------------------------------------
    // Outsider cannot delete -> 403
    let deleteForbidden = false;
    try {
      await fileService.deleteFile(projectA.id, xlsxFile.id, userOutsider.id);
    } catch (err: any) {
      if (err.statusCode === 403) deleteForbidden = true;
    }
    if (!deleteForbidden) throw new Error('SECURITY VIOLATION: Non-member was able to delete file!');

    // Admin deletes xlsxFile
    await fileService.deleteFile(projectA.id, xlsxFile.id, userAdmin.id);

    // Verify metadata deleted
    const countAfter = await prisma.attachment.count({ where: { id: xlsxFile.id } });
    if (countAfter !== 0) throw new Error('File metadata was not deleted from database');

    // Verify storage object deleted
    const xlsxStillExists = await storageService.exists(xlsxFile.storageKey);
    if (xlsxStillExists) throw new Error('Binary storage object should be removed upon file deletion');

    console.log('✅ TEST 7 PASSED: File deletion cleans up both database metadata and object storage.');

    // ----------------------------------------------------
    // TEST 8: File activities logging
    // ----------------------------------------------------
    const activities = await activityService.getProjectActivities(projectA.id, userMember.id, {
      category: 'files',
    });
    if (activities.total < 3) {
      throw new Error(`Expected at least 3 file activities, found ${activities.total}`);
    }
    console.log(`✅ TEST 8 PASSED: File activity feeds logged (Count = ${activities.total}).`);
  } finally {
    // Cleanup database records
    await prisma.project.deleteMany({
      where: { id: { in: [projectA.id, projectB.id] } },
    }).catch(() => {});
    await prisma.user.deleteMany({
      where: { id: { in: [userAdmin.id, userMember.id, userOutsider.id] } },
    }).catch(() => {});
    console.log('\n🧹 Cleaned up test database fixtures.');
  }

  console.log('\n🎉 ALL FILES, STORAGE & RBAC INTEGRATION TESTS PASSED!');
}

runTests().catch((err) => {
  console.error('\n❌ FILES TEST FAILED:', err);
  process.exit(1);
});
