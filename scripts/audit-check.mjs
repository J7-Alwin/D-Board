import { execSync } from 'child_process';

console.log('🔍 Running D-Board Security Audit with Strict Advisory Allowlist...\n');

let auditOutput = '';
let execFailed = false;

try {
  auditOutput = execSync('npm audit --omit=dev --json', {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 30000,
  });
} catch (err) {
  // npm audit exits with code 1 if vulnerabilities are found
  auditOutput = err.stdout?.toString() || '';
  if (!auditOutput && err.stderr) {
    console.error('❌ AUDIT UNAVAILABLE: npm audit execution failed:', err.stderr.toString());
    process.exit(1);
  }
}

if (!auditOutput || !auditOutput.trim()) {
  console.error('❌ AUDIT UNAVAILABLE: No audit output returned from npm audit (possible network failure or missing npm).');
  process.exit(1);
}

let report;
try {
  report = JSON.parse(auditOutput);
} catch (e) {
  console.error('❌ AUDIT UNAVAILABLE: Failed to parse npm audit JSON output (malformed data):', e.message);
  process.exit(1);
}

if (report.error) {
  console.error('❌ AUDIT UNAVAILABLE: npm audit returned an error object:', report.error);
  process.exit(1);
}

if (!report.vulnerabilities || typeof report.vulnerabilities !== 'object') {
  console.error('❌ AUDIT UNAVAILABLE: Missing or invalid vulnerabilities section in npm audit report.');
  process.exit(1);
}

/**
 * Explicit, granular advisory allowlist.
 * Broad package-name wildcard matching is strictly forbidden.
 */
const KNOWN_ACCEPTED_RISKS = [
  {
    package: 'xlsx',
    expectedVersion: '0.18.5',
    allowedAdvisoryIds: [1108110, 1108111, 'GHSA-4r6h-8v6p-xvw6', 'GHSA-5pgg-2g8v-p4x9'],
    riskId: 'RES-01',
    reason: 'Documented residual risk RES-01: spreadsheet parsing isolated in background Web Worker sandbox with strict bounded payload limits (max 20 sheets, max 5000 rows) without DOM, window, or document access.',
  },
  {
    package: 'deepmerge-ts',
    expectedVersion: '<8.0.0',
    allowedAdvisoryIds: [1145093, 'GHSA-ggr8-5vv4-36mx'],
    riskId: 'TOOLING-01',
    reason: 'Prisma CLI schema generation tool transitive dependency (build-time tooling only).',
  },
  {
    package: 'mysql2',
    expectedVersion: '<=3.23.0',
    allowedAdvisoryIds: [1153173, 1158532, 'GHSA-3f6p-5ww8-9rcr', 'GHSA-rgwj-5xj2-c3m3'],
    riskId: 'TOOLING-02',
    reason: 'Prisma CLI multi-provider engine transitive dependency (unused in production PostgreSQL deployment).',
  },
];

let unexpectedHigh = 0;
let unexpectedCritical = 0;

for (const [pkgName, details] of Object.entries(report.vulnerabilities)) {
  const severity = details.severity;
  if (severity === 'critical') {
    console.error(`❌ CRITICAL Vulnerability found in ${pkgName}:`, details.via);
    unexpectedCritical++;
  } else if (severity === 'high') {
    const viaList = Array.isArray(details.via) ? details.via : [details.via];
    
    // Check if this package is a wrapper/transitive affected package (e.g. @prisma/config or prisma affected by deepmerge-ts)
    const isTransitiveWrapper = viaList.every(v => typeof v === 'string');
    
    if (isTransitiveWrapper) {
      // Wrapper package affected by child dependency; verify child dependencies are allowlisted
      console.log(`ℹ️  [TRANSITIVE WRAPPER] Package "${pkgName}" affected via: ${viaList.join(', ')}`);
      continue;
    }

    // Inspect individual advisory objects in 'via'
    let allAdvisoriesApproved = true;
    for (const v of viaList) {
      if (typeof v === 'object' && v !== null) {
        const matchingRisk = KNOWN_ACCEPTED_RISKS.find(
          r => r.package === v.name && (r.allowedAdvisoryIds.includes(v.source) || r.allowedAdvisoryIds.includes(v.url?.split('/').pop()))
        );

        if (matchingRisk) {
          console.log(`⚠️  [AUDIT EXCEPTION ACCEPTED] Package "${v.name}" (${matchingRisk.riskId}):`);
          console.log(`    Source ID: ${v.source} | URL: ${v.url}`);
          console.log(`    Reason: ${matchingRisk.reason}`);
        } else {
          console.error(`❌ UNAPPROVED High Vulnerability in "${v.name}":`, v.title, `(${v.url})`);
          allAdvisoriesApproved = false;
        }
      }
    }

    if (!allAdvisoriesApproved) {
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
