import dotenv from "dotenv";
import path from "path";
import fs from "fs";
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

// Public Supabase Root CA Certificate (used for SSL validation with Supabase PostgreSQL poolers)
const FALLBACK_SUPABASE_CA = `-----BEGIN CERTIFICATE-----
MIIDxDCCAqygAwIBAgIUbLxMod62P2ktCiAkxnKJwtE9VPYwDQYJKoZIhvcNAQEL
BQAwazELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5l
dyBDYXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJh
c2UgUm9vdCAyMDIxIENBMB4XDTIxMDQyODEwNTY1M1oXDTMxMDQyNjEwNTY1M1ow
azELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5ldyBD
YXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJhc2Ug
Um9vdCAyMDIxIENBMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqQXW
QyHOB+qR2GJobCq/CBmQ40G0oDmCC3mzVnn8sv4XNeWtE5XcEL0uVih7Jo4Dkx1Q
DmGHBH1zDfgs2qXiLb6xpw/CKQPypZW1JssOTMIfQppNQ87K75Ya0p25Y3ePS2t2
GtvHxNjUV6kjOZjEn2yWEcBdpOVCUYBVFBNMB4YBHkNRDa/+S4uywAoaTWnCJLUi
cvTlHmMw6xSQQn1UfRQHk50DMCEJ7Cy1RxrZJrkXXRP3LqQL2ijJ6F4yMfh+Gyb4
O4XajoVj/+R4GwywKYrrS8PrSNtwxr5StlQO8zIQUSMiq26wM8mgELFlS/32Uclt
NaQ1xBRizkzpZct9DwIDAQABo2AwXjALBgNVHQ8EBAMCAQYwHQYDVR0OBBYEFKjX
uXY32CztkhImng4yJNUtaUYsMB8GA1UdIwQYMBaAFKjXuXY32CztkhImng4yJNUt
aUYsMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAB8spzNn+4VU
tVxbdMaX+39Z50sc7uATmus16jmmHjhIHz+l/9GlJ5KqAMOx26mPZgfzG7oneL2b
VW+WgYUkTT3XEPFWnTp2RJwQao8/tYPXWEJDc0WVQHrpmnWOFKU/d3MqBgBm5y+6
jB81TU/RG2rVerPDWP+1MMcNNy0491CTL5XQZ7JfDJJ9CCmXSdtTl4uUQnSuv/Qx
Cea13BX2ZgJc7Au30vihLhub52De4P/4gonKsNHYdbWjg7OWKwNv/zitGDVDB9Y2
CMTyZKG3XEu5Ghl1LEnI3QmEKsqaCLv12BnVjbkSeZsMnevJPs1Ye6TjjJwdik5P
o/bKiIz+Fq8=
-----END CERTIFICATE-----`;

let caCert: string | undefined;
if (process.env.DATABASE_CA_CERT) {
    caCert = process.env.DATABASE_CA_CERT;
} else if (process.env.DATABASE_CA_PATH && fs.existsSync(process.env.DATABASE_CA_PATH)) {
    caCert = fs.readFileSync(process.env.DATABASE_CA_PATH, 'utf-8');
} else {
    const defaultSupabaseCa = path.resolve(__dirname, '../certs/supabase-root-ca.pem');
    if (fs.existsSync(defaultSupabaseCa)) {
        caCert = fs.readFileSync(defaultSupabaseCa, 'utf-8');
    } else if (
        connectionString.includes('supabase.co') ||
        connectionString.includes('supabase.com') ||
        connectionString.includes('pooler.supabase.com')
    ) {
        caCert = FALLBACK_SUPABASE_CA;
    }
}

const isRemoteOrSsl = 
    process.env.DATABASE_SSL === 'true' ||
    connectionString.includes('sslmode=require') ||
    connectionString.includes('supabase.co') ||
    connectionString.includes('supabase.com') ||
    connectionString.includes('pooler.supabase.com');

const sslConfig = isRemoteOrSsl
    ? {
        rejectUnauthorized: process.env.DATABASE_REJECT_UNAUTHORIZED === 'false' ? false : true,
        ca: caCert,
    }
    : undefined;

const pool = new pg.Pool({
    connectionString,
    ssl: sslConfig,
    max: parseInt(process.env.DB_POOL_MAX || '10', 10),
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
    adapter,
});

export { prisma, Prisma };
export default prisma;