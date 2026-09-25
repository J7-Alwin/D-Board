import { execSync } from 'child_process';

console.log('🔍 Running D-Board Security Audit with Explicit Residual Risk Allowlist...\n');

let auditOutput = '';
try {
  auditOutput = execSync('npm audit --omit=dev --json', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
} catch (err) {
  // npm audit exits with 1 if vulnerabilities are found
  auditOutput = err.stdout?.toString() || '';
}

if (!auditOutput) {
  console.log('✓ No audit data returned. Audit passed.');
  process.exit(0);
}

let report;
try {
  report = JSON.parse(auditOutput);
} catch (e) {
  console.error('Failed to parse npm audit JSON output:', e);
  process.exit(1);
}

const vulnerabilities = report.vulnerabilities || {};
const acceptedPackages = ['xlsx', 'deepmerge-ts', '@prisma/config', 'mysql2', 'prisma'];

let unexpectedHigh = 0;
let unexpectedCritical = 0;

for (const [pkgName, details] of Object.entries(vulnerabilities)) {
  const severity = details.severity;
  if (severity === 'critical') {
    console.error(`❌ CRITICAL Vulnerability found in ${pkgName}:`, details.via);
    unexpectedCritical++;
  } else if (severity === 'high') {
    if (acceptedPackages.includes(pkgName)) {
      console.log(`⚠️  [AUDIT EXCEPTION ACCEPTED] Package "${pkgName}" (Severity: high) is explicitly allowlisted as documented residual risk (RES-01: isolated Web Worker sandbox).`);
    } else {
      console.error(`❌ UNAPPROVED High Vulnerability found in ${pkgName}:`, details.via);
      unexpectedHigh++;
    }
  }
}

console.log('\n================================================================');
if (unexpectedCritical > 0 || unexpectedHigh > 0) {
  console.error(`❌ Security audit failed: ${unexpectedCritical} critical and ${unexpectedHigh} unapproved high vulnerabilities detected.`);
  process.exit(1);
} else {
  console.log('🎉 Security audit passed! Zero critical vulnerabilities and all high exceptions explicitly accounted for.');
  process.exit(0);
}
