/**
 * D-BOARD: Safe One-Time Storage Migration Tool (Local -> Cloudflare R2 / S3)
 *
 * Requirements:
 * - Enumerates local StoredObject records from database
 * - Verifies SHA-256 hashes against contentHash before upload
 * - Uploads to R2 / S3 via S3StorageProvider
 * - Verifies existence after upload
 * - Preserves deduplication (StoredObject 1-to-1 with key)
 * - Supports dry run via --dry-run
 * - Never deletes local files before (or during) verification
 * - Resilient: can be safely re-run (idempotent)
 */

import crypto from 'node:crypto';
import path from 'node:path';
import dotenv from 'dotenv';

// Load API environment variables
dotenv.config({ path: path.resolve(process.cwd(), 'apps/api/.env') });

import prisma from '../apps/api/src/prisma.js';
import { LocalStorageProvider } from '../apps/api/src/storage/localStorage.provider.js';
import { S3StorageProvider } from '../apps/api/src/storage/s3Storage.provider.js';

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');

  console.log('====================================================');
  console.log('D-BOARD STORAGE MIGRATION TOOL: LOCAL -> R2 / S3');
  console.log(`Mode: ${isDryRun ? 'DRY RUN (no uploads)' : 'LIVE EXECUTION'}`);
  console.log('====================================================\n');

  if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage: npx tsx scripts/migrate-storage-to-r2.ts [--dry-run]');
    console.log('Required Environment Variables:');
    console.log('  S3_ENDPOINT          Cloudflare R2 S3 API endpoint');
    console.log('  S3_BUCKET            Target bucket name');
    console.log('  S3_ACCESS_KEY_ID     Target R2 API token Access Key ID');
    console.log('  S3_SECRET_ACCESS_KEY  Target R2 API token Secret Access Key');
    console.log('  S3_REGION            Region (defaults to "auto" for R2)');
    process.exit(0);
  }

  const hasCredentials = (process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID) &&
    (process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY);

  if (!hasCredentials) {
    console.log('[Notice] S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY not configured.');
    console.log('To run this migration against Cloudflare R2, supply the credentials in apps/api/.env or environment.');
    console.log('Use --help for more information.');
    process.exit(0);
  }

  const localProvider = new LocalStorageProvider();
  let s3Provider: S3StorageProvider;

  try {
    s3Provider = new S3StorageProvider();
  } catch (err: any) {
    console.error('ERROR: Failed to initialize S3 / R2 provider. Please ensure S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY are set.');
    console.error(err.message);
    process.exit(1);
  }

  // Check R2 connectivity
  console.log('Verifying R2 / S3 destination bucket access...');
  try {
    const health = await s3Provider.checkHealth();
    if (health.status !== 'healthy') {
      console.error(`Destination bucket check failed: ${health.error}`);
      process.exit(1);
    }
    console.log('Destination bucket verified successfully.\n');
  } catch (err: any) {
    console.error(`Destination connectivity error: ${err.message}`);
    process.exit(1);
  }

  const storedObjects = await prisma.storedObject.findMany({
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Found ${storedObjects.length} StoredObject record(s) in database.\n`);

  let alreadyMigrated = 0;
  let newlyUploaded = 0;
  let missingLocally = 0;
  let hashMismatches = 0;
  let failedUploads = 0;

  for (const obj of storedObjects) {
    const { storageKey, contentHash, mimeType, projectId } = obj;
    console.log(`-> Processing object: ${storageKey} (Project: ${projectId})`);

    // 1. Check if already present on R2
    const remoteExists = await s3Provider.exists(storageKey);
    if (remoteExists) {
      console.log(`   [SKIP] Already present in remote R2 storage.`);
      alreadyMigrated++;
      continue;
    }

    // 2. Check local existence
    const localExists = await localProvider.exists(storageKey);
    if (!localExists) {
      console.warn(`   [WARN] Local file missing on disk for key: ${storageKey}`);
      missingLocally++;
      continue;
    }

    // 3. Read buffer and verify SHA-256 hash
    let buffer: Buffer;
    try {
      buffer = await localProvider.getBuffer(storageKey);
    } catch (err: any) {
      console.error(`   [ERROR] Failed to read local file: ${err.message}`);
      missingLocally++;
      continue;
    }

    const calculatedHash = crypto.createHash('sha256').update(buffer).digest('hex');
    if (calculatedHash !== contentHash) {
      console.error(`   [HASH MISMATCH] Stored: ${contentHash}, Calculated: ${calculatedHash}. Aborting upload for this file.`);
      hashMismatches++;
      continue;
    }

    // 4. Upload to R2
    if (isDryRun) {
      console.log(`   [DRY RUN] Would upload ${buffer.length} bytes (MIME: ${mimeType}) to R2.`);
      newlyUploaded++;
    } else {
      try {
        console.log(`   [UPLOADING] Uploading ${buffer.length} bytes to R2...`);
        await s3Provider.upload(storageKey, buffer, mimeType);

        // 5. Verify upload on remote
        const verified = await s3Provider.exists(storageKey);
        if (!verified) {
          throw new Error('Post-upload verification failed (object not found on R2 after upload)');
        }

        console.log(`   [SUCCESS] Uploaded and verified on R2.`);
        newlyUploaded++;
      } catch (uploadErr: any) {
        console.error(`   [UPLOAD ERROR] ${uploadErr.message}`);
        failedUploads++;
      }
    }
  }

  console.log('\n====================================================');
  console.log('MIGRATION SUMMARY');
  console.log('====================================================');
  console.log(`Total StoredObjects:  ${storedObjects.length}`);
  console.log(`Already on R2:        ${alreadyMigrated}`);
  console.log(`Newly Uploaded:       ${newlyUploaded} ${isDryRun ? '(simulated)' : ''}`);
  console.log(`Missing Locally:      ${missingLocally}`);
  console.log(`Hash Mismatches:      ${hashMismatches}`);
  console.log(`Failed Uploads:       ${failedUploads}`);
  console.log('Local files were left 100% intact.');
  console.log('====================================================\n');

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('Fatal migration script error:', err);
  await prisma.$disconnect();
  process.exit(1);
});
