import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "./generated/prisma/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
if (!process.env.DATABASE_URL) {
    dotenv.config({ path: path.resolve(__dirname, "../.env") });
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error("DATABASE_URL is not defined");
}

const isRemoteOrSsl = 
    process.env.DATABASE_SSL === 'true' ||
    connectionString.includes('sslmode=require') ||
    connectionString.includes('supabase.co') ||
    connectionString.includes('supabase.com') ||
    connectionString.includes('pooler.supabase.com');

const pool = new pg.Pool({
    connectionString,
    ssl: isRemoteOrSsl ? { rejectUnauthorized: false } : undefined,
    max: parseInt(process.env.DB_POOL_MAX || '10', 10),
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
    adapter,
});

export { prisma, Prisma };
export default prisma;