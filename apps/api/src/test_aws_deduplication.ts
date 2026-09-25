import { prisma } from './prisma.js';
import { fileService } from './services/file.service.js';
import { storageService } from './storage/storage.service.js';

async function runAwsDeduplicationTests() {
  console.log('📦 === STARTING AWS S3 STORAGE & DEDUPLICATION VERIFICATION SUITE ===\n');
  const timestamp = Date.now();

  // Create test users and projects
  const userA = await prisma.user.create({
    data: {
      email: `user_a_${timestamp}@example.com`,
      username: `usera_${timestamp}`,
      fullName: 'Project A Lead',
      isEmailVerified: true,
      passwordHash: 'dummy',
    },
  });

  const userB = await prisma.user.create({
    data: {
      email: `user_b_${timestamp}@example.com`,
      username: `userb_${timestamp}`,
      fullName: 'Project B Lead',
      isEmailVerified: true,
      passwordHash: 'dummy',
    },
  });

  const projA = await prisma.project.create({
    data: {
      name: `Project Alpha ${timestamp}`,
      key: 'PRJA',
      description: 'Alpha storage workspace',
      createdById: userA.id,
      members: {
        create: { userId: userA.id, role: 'PROJECT_ADMIN' },
      },
    },
  });

  const projB = await prisma.project.create({
    data: {
      name: `Project Beta ${timestamp}`,
      key: 'PRJB',
      description: 'Beta isolated storage workspace',
      createdById: userB.id,
      members: {
        create: { userId: userB.id, role: 'PROJECT_ADMIN' },
      },
    },
  });

  try {
    // ---------------------------------------------------------------------------
    // TEST 1: Section 43 - Project A uploads test1.pdf and copy_of_test1.pdf
    // ---------------------------------------------------------------------------
    console.log('--- TEST 1: Exact Binary Deduplication Within Same Project ---');
    const pdfBytes = Buffer.from('%PDF-1.4 Mock Binary Content for Deduplication Verification 2026');
    const expectedHash = storageService.computeChecksum(pdfBytes);

    // Upload 1: test1.pdf to Project A
    const [attA1] = await fileService.uploadFiles(
      projA.id,
      userA.id,
      [{
        originalname: 'test1.pdf',
        mimetype: 'application/pdf',
        size: pdfBytes.length,
        buffer: pdfBytes,
      }]
    );

    if (!attA1 || !attA1.storedObjectId) {
      throw new Error('Upload 1 failed to create Attachment or StoredObject');
    }

    const initialStoredObject = await prisma.storedObject.findUnique({
      where: { id: attA1.storedObjectId },
    });
    if (!initialStoredObject || initialStoredObject.contentHash !== expectedHash) {
      throw new Error('StoredObject contentHash mismatch');
    }

    const s3ObjectExists = await storageService.exists(attA1.storageKey);
    if (!s3ObjectExists) {
      throw new Error('Physical storage object does not exist after initial upload');
    }
    console.log('✓ Upload 1 (test1.pdf): Created logical file and physical S3 object');

    // Upload 2: copy_of_test1.pdf with IDENTICAL bytes to Project A
    const [attA2] = await fileService.uploadFiles(
      projA.id,
      userA.id,
      [{
        originalname: 'copy_of_test1.pdf',
        mimetype: 'application/pdf',
        size: pdfBytes.length,
        buffer: pdfBytes,
      }]
    );

    if (!attA2 || !attA2.storedObjectId) {
      throw new Error('Upload 2 failed to create logical file');
    }

    // Verify deduplication invariant
    if (attA2.storedObjectId !== attA1.storedObjectId) {
      throw new Error('Deduplication failure: New StoredObject created for duplicate bytes in same project');
    }
    if (attA2.storageKey !== attA1.storageKey) {
      throw new Error('Deduplication failure: Storage keys differ for duplicate bytes');
    }

    const storedObjectsCountA = await prisma.storedObject.count({
      where: { projectId: projA.id },
    });
    if (storedObjectsCountA !== 1) {
      throw new Error(`Expected exactly 1 StoredObject in Project A, found ${storedObjectsCountA}`);
    }

    const attachmentsCountA = await prisma.attachment.count({
      where: { projectId: projA.id, deletedAt: null },
    });
    if (attachmentsCountA !== 2) {
      throw new Error(`Expected 2 logical Attachment records in Project A, found ${attachmentsCountA}`);
    }
    console.log('✓ Upload 2 (copy_of_test1.pdf): Successfully deduplicated to single physical S3 object');

    // ---------------------------------------------------------------------------
    // TEST 2: Section 43 - Delete test1.pdf (Physical S3 object MUST remain)
    // ---------------------------------------------------------------------------
    console.log('\n--- TEST 2: Reference-Counted Physical Storage Preservation ---');
    await fileService.deleteFile(projA.id, attA1.id, userA.id);

    const s3ObjectStillExists = await storageService.exists(attA1.storageKey);
    if (!s3ObjectStillExists) {
      throw new Error('VIOLATION: Physical S3 object was deleted while copy_of_test1.pdf still references it!');
    }

    const storedObjectAfterDelete1 = await prisma.storedObject.findUnique({
      where: { id: attA1.storedObjectId },
    });
    if (!storedObjectAfterDelete1) {
      throw new Error('StoredObject record was deleted prematurely while reference count > 0');
    }
    console.log('✓ Deleting test1.pdf preserved physical S3 object because copy_of_test1.pdf still references it');

    // ---------------------------------------------------------------------------
    // TEST 3: Section 43 - Delete copy_of_test1.pdf (Physical S3 object MUST be deleted)
    // ---------------------------------------------------------------------------
    console.log('\n--- TEST 3: Zero-Reference Physical S3 Object Cleanup ---');
    await fileService.deleteFile(projA.id, attA2.id, userA.id);

    const s3ObjectFinallyDeleted = await storageService.exists(attA1.storageKey);
    if (s3ObjectFinallyDeleted) {
      throw new Error('VIOLATION: Physical S3 object was not deleted after all references were deleted!');
    }

    const storedObjectAfterDelete2 = await prisma.storedObject.findUnique({
      where: { id: attA1.storedObjectId },
    });
    if (storedObjectAfterDelete2) {
      throw new Error('StoredObject record was not deleted after zero references remained');
    }
    console.log('✓ Deleting copy_of_test1.pdf cleanly removed physical S3 object and StoredObject metadata');

    // ---------------------------------------------------------------------------
    // TEST 4: Section 43 - Project B isolation (No cross-project leakage)
    // ---------------------------------------------------------------------------
    console.log('\n--- TEST 4: Cross-Project Physical Storage Isolation ---');
    // Upload identical binary to Project A again
    const [freshAttA] = await fileService.uploadFiles(
      projA.id,
      userA.id,
      [{
        originalname: 'doc_a.pdf',
        mimetype: 'application/pdf',
        size: pdfBytes.length,
        buffer: pdfBytes,
      }]
    );

    // Upload IDENTICAL binary to Project B
    const [freshAttB] = await fileService.uploadFiles(
      projB.id,
      userB.id,
      [{
        originalname: 'doc_b.pdf',
        mimetype: 'application/pdf',
        size: pdfBytes.length,
        buffer: pdfBytes,
      }]
    );

    // Project B MUST have a distinct storage key from Project A
    if (freshAttA.storageKey === freshAttB.storageKey) {
      throw new Error('SECURITY VIOLATION: Cross-project storage keys collided! Physical storage must be project-isolated');
    }
    if (freshAttA.storedObjectId === freshAttB.storedObjectId) {
      throw new Error('SECURITY VIOLATION: Cross-project StoredObject shared across projects! Information leak risk');
    }
    if (!freshAttA.storageKey.includes(projA.id) || !freshAttB.storageKey.includes(projB.id)) {
      throw new Error('Storage key does not contain appropriate project namespace');
    }
    console.log('✓ Same binary uploaded to Project A and Project B resulted in separate, isolated physical objects');

    // User A cannot access Project B's file
    let crossAccessBlocked = false;
    try {
      await fileService.getFileById(projB.id, freshAttB.id, userA.id);
    } catch (err: any) {
      if (err.statusCode === 403) crossAccessBlocked = true;
    }
    if (!crossAccessBlocked) {
      throw new Error('SECURITY VIOLATION: User A was able to access Project B file metadata');
    }
    console.log('✓ Cross-project access attempt blocked with 403 Forbidden');

    // ---------------------------------------------------------------------------
    // TEST 5: Section 44 - Concurrent Duplicate Upload Race Condition Handling
    // ---------------------------------------------------------------------------
    console.log('\n--- TEST 5: Concurrent Duplicate Upload Race Condition Safety ---');
    const concurrentBytes = Buffer.from('CONCURRENT_RACE_TEST_PAYLOAD_' + timestamp);

    const [uploadRes1, uploadRes2] = await Promise.all([
      fileService.uploadFiles(
        projA.id,
        userA.id,
        [{
          originalname: 'race_file_1.txt',
          mimetype: 'text/plain',
          size: concurrentBytes.length,
          buffer: concurrentBytes,
        }]
      ),
      fileService.uploadFiles(
        projA.id,
        userA.id,
        [{
          originalname: 'race_file_2.txt',
          mimetype: 'text/plain',
          size: concurrentBytes.length,
          buffer: concurrentBytes,
        }]
      ),
    ]);

    const attR1 = uploadRes1[0];
    const attR2 = uploadRes2[0];

    // Both must point to the same physical stored object
    if (attR1.storedObjectId !== attR2.storedObjectId) {
      throw new Error('Race condition allowed duplicate StoredObject for identical concurrent uploads');
    }
    if (attR1.storageKey !== attR2.storageKey) {
      throw new Error('Race condition created differing storageKeys for identical concurrent uploads');
    }

    const raceStoredObjectCount = await prisma.storedObject.count({
      where: {
        projectId: projA.id,
        contentHash: storageService.computeChecksum(concurrentBytes),
      },
    });
    if (raceStoredObjectCount !== 1) {
      throw new Error(`Expected exactly 1 StoredObject after race, found ${raceStoredObjectCount}`);
    }
    console.log('✓ Concurrent upload race condition safely resolved to single StoredObject and S3 key');

    // ---------------------------------------------------------------------------
    // TEST 6: File Rename Content Invariant
    // ---------------------------------------------------------------------------
    console.log('\n--- TEST 6: File Rename Content Identity Invariant ---');
    const renamed = await fileService.renameFile(projA.id, attR1.id, userA.id, 'renamed_race_file.pdf');
    if (renamed.storageKey !== attR1.storageKey) {
      throw new Error('Renaming file mutated the underlying physical storageKey');
    }
    if (renamed.storedObjectId !== attR1.storedObjectId) {
      throw new Error('Renaming file mutated the storedObjectId');
    }
    if (renamed.checksum !== attR1.checksum) {
      throw new Error('Renaming file mutated the content hash');
    }
    console.log('✓ Rename updated display metadata while preserving underlying binary identity');

    // Clean up
    await fileService.deleteFile(projA.id, freshAttA.id, userA.id).catch(() => {});
    await fileService.deleteFile(projB.id, freshAttB.id, userB.id).catch(() => {});
    await fileService.deleteFile(projA.id, attR1.id, userA.id).catch(() => {});
    await fileService.deleteFile(projA.id, attR2.id, userA.id).catch(() => {});

  } finally {
    await prisma.activity.deleteMany({ where: { projectId: { in: [projA.id, projB.id] } } }).catch(() => {});
    await prisma.attachment.deleteMany({ where: { projectId: { in: [projA.id, projB.id] } } }).catch(() => {});
    await prisma.storedObject.deleteMany({ where: { projectId: { in: [projA.id, projB.id] } } }).catch(() => {});
    await prisma.projectMember.deleteMany({ where: { projectId: { in: [projA.id, projB.id] } } }).catch(() => {});
    await prisma.project.deleteMany({ where: { id: { in: [projA.id, projB.id] } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } }).catch(() => {});
  }

  console.log('\n================================================================');
  console.log('🎉 ALL AWS STORAGE & SECURE DEDUPLICATION TESTS PASSED (100%)!');
  console.log('================================================================\n');
}

runAwsDeduplicationTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ AWS DEDUPLICATION TEST FAILED:', err);
    process.exit(1);
  });
