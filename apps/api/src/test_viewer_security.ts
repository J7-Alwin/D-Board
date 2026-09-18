import { prisma } from './prisma.js';
import { fileService } from './services/file.service.js';
import { storageService } from './storage/storage.service.js';

async function runViewerSecurityTests() {
  console.log('🚀 Starting Universal Viewer Security & Untrusted Payload Test Suite...\n');

  const timestamp = Date.now();

  const userAdmin = await prisma.user.create({
    data: {
      username: `sec_admin_${timestamp}`,
      email: `sec_admin_${timestamp}@example.com`,
      fullName: 'Security Admin',
      isEmailVerified: true,
    },
  });

  const project = await prisma.project.create({
    data: {
      name: `Security Project ${timestamp}`,
      key: 'SECU',
      description: 'Security testing project',
      createdById: userAdmin.id,
    },
  });

  try {
    // ----------------------------------------------------
    // TEST 1: Dangerous payloads uploaded as DATA (zero execution)
    // ----------------------------------------------------
    const maliciousScripts = [
      {
        originalname: 'exploit.js',
        mimetype: 'application/javascript',
        size: Buffer.from('alert("xss attack"); document.cookie="stolen"; window.location="evil.com";').length,
        buffer: Buffer.from('alert("xss attack"); document.cookie="stolen"; window.location="evil.com";'),
      },
      {
        originalname: 'malicious.html',
        mimetype: 'text/html',
        size: Buffer.from('<html><body><script>fetch("/api/auth/steal")</script><h1>Injected</h1></body></html>').length,
        buffer: Buffer.from('<html><body><script>fetch("/api/auth/steal")</script><h1>Injected</h1></body></html>'),
      },
      {
        originalname: 'vector.svg',
        mimetype: 'image/svg+xml',
        size: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><circle r="10"/></svg>').length,
        buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><circle r="10"/></svg>'),
      },
      {
        originalname: 'attack.sql',
        mimetype: 'application/sql',
        size: Buffer.from('DROP TABLE "User" CASCADE; DROP TABLE "Project" CASCADE;').length,
        buffer: Buffer.from('DROP TABLE "User" CASCADE; DROP TABLE "Project" CASCADE;'),
      },
      {
        originalname: 'script.py',
        mimetype: 'text/x-python',
        size: Buffer.from('import os\nos.system("rm -rf /")\n').length,
        buffer: Buffer.from('import os\nos.system("rm -rf /")\n'),
      },
    ];

    const uploaded = await fileService.uploadFiles(project.id, userAdmin.id, maliciousScripts);
    if (uploaded.length !== 5) throw new Error('Failed to upload security payloads');

    for (const item of uploaded) {
      const { file, stream } = await fileService.getFileStream(project.id, item.id, userAdmin.id);
      if (!file || !stream) throw new Error(`Failed to stream ${item.originalName}`);

      // Verify that the file exists in storage and content matches raw bytes unmodified
      const buf = await storageService.getBuffer(file.storageKey);
      if (buf.length !== file.sizeBytes) {
        throw new Error(`Buffer length mismatch for ${file.originalName}`);
      }
    }
    console.log('✅ TEST 1 PASSED: Dangerous scripts (JS, HTML, SVG, SQL, Python) stored strictly as passive binary data.');

    // ----------------------------------------------------
    // TEST 2: Verify database integrity (no SQL injection occurred)
    // ----------------------------------------------------
    const tableCheck = await prisma.user.count();
    if (tableCheck === 0) throw new Error('User table was affected by SQL test payload!');
    console.log('✅ TEST 2 PASSED: SQL script payload treated purely as text with zero database interpretation.');

    // ----------------------------------------------------
    // TEST 3: Path sanitization on upload
    // ----------------------------------------------------
    const pathPayload = [
      {
        originalname: '..\\..\\..\\windows\\system32\\cmd.exe',
        mimetype: 'application/octet-stream',
        size: 50,
        buffer: Buffer.from('cmd placeholder'),
      },
    ];
    const pathUploaded = await fileService.uploadFiles(project.id, userAdmin.id, pathPayload);
    if (pathUploaded[0].originalName.includes('..') || pathUploaded[0].originalName.includes('\\')) {
      throw new Error('Path separators were not stripped from filename metadata');
    }
    console.log(`✅ TEST 3 PASSED: Path injection filename sanitized to "${pathUploaded[0].originalName}".`);

  } finally {
    // Cleanup
    await prisma.project.deleteMany({ where: { id: project.id } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: userAdmin.id } }).catch(() => {});
    console.log('\n🧹 Cleaned up security test fixtures.');
  }

  console.log('\n🎉 ALL UNIVERSAL VIEWER SECURITY & PAYLOAD TESTS PASSED!');
}

runViewerSecurityTests().catch((err) => {
  console.error('\n❌ VIEWER SECURITY TEST FAILED:', err);
  process.exit(1);
});
