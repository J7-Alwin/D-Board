import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(__dirname, '../src/generated/prisma');
const distDir = path.resolve(__dirname, '../dist/generated/prisma');

if (!fs.existsSync(srcDir)) {
  console.error(`❌ Error: Prisma generated client not found at ${srcDir}. Please run 'npx prisma generate' before building.`);
  process.exit(1);
}

fs.mkdirSync(distDir, { recursive: true });
fs.cpSync(srcDir, distDir, { recursive: true });
console.log('✅ Successfully copied generated Prisma client to dist/generated/prisma');
