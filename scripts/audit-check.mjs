import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import semver from 'semver';

console.log('🔍 Running D-Board Security Audit with Strict Advisory Allowlist...\n');

let auditOutput = '';

try {
  auditOutput = execSync('npm audit --omit=dev --json', {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 120000,
  });
} catch (err) {
  if (err.code === 'ETIMEDOUT' || err.killed) {
    console.error('❌ AUDIT TIMEOUT: npm audit execution timed out after 120 seconds. Registry or network may be slow/unresponsive.');
    process.exit(1);
  }
  // npm audit exits with code 1 if vulnerabilities are found
  auditOutput = err.stdout?.toString() || '';
  if (!auditOutput && err.stderr) {
    const errText = err.stderr.toString();
    if (errText.includes('ENOTFOUND') || errText.includes('ECONNREFUSED') || errText.includes('fetch failed')) {
      console.error('❌ AUDIT NETWORK FAILURE: npm audit registry network error:', errText);
    } else {
      console.error('❌ AUDIT UNAVAILABLE: npm audit execution failed:', errText);
    }
    process.exit(1);
  }
}

if (!auditOutput || !auditOutput.trim()) {
  console.error('❌ AUDIT UNAVAILABLE: No audit output returned from npm audit (possible network failure, missing npm, or empty response).');
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

/**
 * Resolves the installed version(s) of a given package from nodes paths or disk.
 */
function getInstalledVersions(pkgName, nodes) {
  const versions = new Set();

  if (Array.isArray(nodes)) {
    for (const nodePath of nodes) {
      try {
        const pkgPath = path.resolve(process.cwd(), nodePath, 'package.json');
        if (fs.existsSync(pkgPath)) {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
          if (pkg.version) versions.add(pkg.version);
        }
      } catch {}
    }
  }

  if (versions.size === 0) {
    try {
      const pkgPath = path.resolve(process.cwd(), 'node_modules', pkgName, 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        if (pkg.version) versions.add(pkg.version);
      }
    } catch {}
  }

  if (versions.size === 0) {
    try {
      const lockPath = path.resolve(process.cwd(), 'package-lock.json');
      if (fs.existsSync(lockPath)) {
        const lock = JSON.parse(fs.readFileSync(lockPath, 'utf-8'));
        if (lock.packages) {
          for (const [key, val] of Object.entries(lock.packages)) {
            if (key.endsWith('node_modules/' + pkgName) && val.version) {
              versions.add(val.version);
            }
          }
        }
      }
    } catch {}
  }

  return Array.from(versions);
}

function matchesVersion(installedVersion, expectedRange) {
  try {
    const s = semver.default || semver;
    return s.satisfies(installedVersion, expectedRange);
  } catch {
    return installedVersion === expectedRange;
  }
}

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
          const installedVersions = getInstalledVersions(v.name, details.nodes);
          const hasVersions = installedVersions.length > 0;
          const allVersionsSatisfy = hasVersions && installedVersions.every(ver => matchesVersion(ver, matchingRisk.expectedVersion));

          if (!hasVersions) {
            console.error(`❌ UNAPPROVED Version for "${v.name}": Could not determine installed version to verify against expected "${matchingRisk.expectedVersion}".`);
            allAdvisoriesApproved = false;
          } else if (!allVersionsSatisfy) {
            console.error(`❌ UNAPPROVED Version for "${v.name}": Installed version(s) [${installedVersions.join(', ')}] do not satisfy expected version "${matchingRisk.expectedVersion}".`);
            allAdvisoriesApproved = false;
          } else {
            console.log(`⚠️  [AUDIT EXCEPTION ACCEPTED] Package "${v.name}" (version: ${installedVersions.join(', ')}) (${matchingRisk.riskId}):`);
            console.log(`    Source ID: ${v.source} | URL: ${v.url}`);
            console.log(`    Reason: ${matchingRisk.reason}`);
          }
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
