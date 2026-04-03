#!/usr/bin/env node
/**
 * IaC Security Baseline Validator
 *
 * Validates that generated Bicep (.bicep) and Terraform (.tf) files
 * comply with the MANDATORY security baseline from azure-defaults skill
 * and AGENTS.md:
 *
 * 1. TLS 1.2 minimum on all services
 * 2. HTTPS-only traffic
 * 3. No public blob access
 * 4. Managed identity preferred (warning only — not all resources need it)
 *
 * Enforces Golden Principle #10: Mechanical Enforcement Over Documentation.
 *
 * Limitation: Regex-based single-line matching. Nested or multi-line property
 * assignments may not be caught. This is a known trade-off for speed.
 *
 * @example
 * node scripts/validate-iac-security-baseline.mjs
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

let errors = 0;
let warnings = 0;
let checks = 0;
let filesScanned = 0;

function fail(file, line, message) {
  checks++;
  errors++;
  console.error(`  ❌ ${file}:${line} — ${message}`);
}

function warn(file, line, message) {
  warnings++;
  console.warn(`  ⚠️  ${file}:${line} — ${message}`);
}

function pass(description) {
  checks++;
  console.log(`  ✅ ${description}`);
}

// --- Bicep security anti-patterns ---
// Each entry: [regex, description]
const BICEP_VIOLATIONS = [
  [
    /minimumTlsVersion\s*:\s*'TLS1_0'/i,
    "TLS 1.0 is NOT allowed — MUST be TLS1_2 or higher",
  ],
  [
    /minimumTlsVersion\s*:\s*'TLS1_1'/i,
    "TLS 1.1 is NOT allowed — MUST be TLS1_2 or higher",
  ],
  [
    /minTlsVersion\s*:\s*'TLS1_0'/i,
    "TLS 1.0 is NOT allowed — MUST be TLS1_2 or higher",
  ],
  [
    /minTlsVersion\s*:\s*'TLS1_1'/i,
    "TLS 1.1 is NOT allowed — MUST be TLS1_2 or higher",
  ],
  [/supportsHttpsTrafficOnly\s*:\s*false/i, "HTTPS-only traffic MUST be true"],
  [
    /allowBlobPublicAccess\s*:\s*true/i,
    "Public blob access MUST be disabled (false)",
  ],
  [
    /publicNetworkAccess\s*:\s*'Enabled'/i,
    "Public network access SHOULD be disabled for production data services",
  ],
  [/httpsOnly\s*:\s*false/i, "HTTPS-only MUST be enabled"],
  // --- MUST-FAIL: SQL Entra-only auth ---
  [
    /azureADOnlyAuthentication\s*:\s*false/i,
    "SQL Entra-only auth required (azureADOnlyAuthentication must be true)",
  ],
  // --- MUST-FAIL: Redis non-SSL port ---
  [
    /enableNonSslPort\s*:\s*true/i,
    "Redis non-SSL port NOT allowed (enableNonSslPort must be false)",
  ],
  // --- MUST-FAIL: FTPS state ---
  [
    /ftpsState\s*:\s*'AllAllowed'/i,
    "FTPS must be Disabled or FtpsOnly (AllAllowed not permitted)",
  ],
  // --- MUST-FAIL: Remote debugging ---
  [
    /remoteDebuggingEnabled\s*:\s*true/i,
    "Remote debugging NOT allowed in production",
  ],
  // --- MUST-FAIL: Cosmos DB local auth ---
  [
    /disableLocalAuth\s*:\s*false/i,
    "Cosmos DB local auth must be disabled (disableLocalAuth must be true)",
  ],
  // --- MUST-FAIL: PostgreSQL SSL ---
  [
    /sslEnforcement\s*:\s*'Disabled'/i,
    "PostgreSQL SSL enforcement required (sslEnforcement must be Enabled)",
  ],
];

// --- Bicep WARN-ONLY patterns (flag but don't block) ---
const BICEP_WARNINGS = [
  [
    /networkAcls\s*:\s*\{[^}]*defaultAction\s*:\s*'Allow'/i,
    "Key Vault network ACLs default action should be Deny, not Allow",
  ],
  [
    /allowedOrigins\s*:\s*\[\s*'\*'\s*\]/i,
    "Wildcard CORS origin (*) should be restricted to specific domains",
  ],
];

// --- Terraform security anti-patterns ---
const TERRAFORM_VIOLATIONS = [
  [
    /min_tls_version\s*=\s*"1\.0"/i,
    "TLS 1.0 is NOT allowed — MUST be 1.2 or higher",
  ],
  [
    /min_tls_version\s*=\s*"1\.1"/i,
    "TLS 1.1 is NOT allowed — MUST be 1.2 or higher",
  ],
  [
    /minimum_tls_version\s*=\s*"1\.0"/i,
    "TLS 1.0 is NOT allowed — MUST be 1.2 or higher",
  ],
  [
    /minimum_tls_version\s*=\s*"1\.1"/i,
    "TLS 1.1 is NOT allowed — MUST be 1.2 or higher",
  ],
  [
    /https_traffic_only_enabled\s*=\s*false/i,
    "HTTPS-only traffic MUST be true",
  ],
  [
    /enable_https_traffic_only\s*=\s*false/i,
    "HTTPS-only traffic MUST be true (legacy attribute)",
  ],
  [
    /allow_nested_items_to_be_public\s*=\s*true/i,
    "Public blob access MUST be disabled (false)",
  ],
  [
    /public_network_access_enabled\s*=\s*true/i,
    "Public network access SHOULD be disabled for production data services",
  ],
  [
    /allow_blob_public_access\s*=\s*true/i,
    "Public blob access MUST be disabled (legacy attribute)",
  ],
  [/https_only\s*=\s*false/i, "HTTPS-only MUST be enabled"],
  // --- MUST-FAIL: SQL Entra-only auth ---
  [
    /azuread_authentication_only\s*=\s*false/i,
    "SQL Entra-only auth required (azuread_authentication_only must be true)",
  ],
  // --- MUST-FAIL: Redis non-SSL port ---
  [
    /enable_non_ssl_port\s*=\s*true/i,
    "Redis non-SSL port NOT allowed (enable_non_ssl_port must be false)",
  ],
  // --- MUST-FAIL: FTPS state ---
  [
    /ftps_state\s*=\s*"AllAllowed"/i,
    "FTPS must be Disabled or FtpsOnly (AllAllowed not permitted)",
  ],
  // --- MUST-FAIL: Remote debugging ---
  [
    /remote_debugging_enabled\s*=\s*true/i,
    "Remote debugging NOT allowed in production",
  ],
  // --- MUST-FAIL: Cosmos DB local auth ---
  [
    /local_authentication_disabled\s*=\s*false/i,
    "Cosmos DB local auth must be disabled (local_authentication_disabled must be true)",
  ],
  // --- MUST-FAIL: PostgreSQL SSL ---
  [
    /ssl_enforcement_enabled\s*=\s*false/i,
    "PostgreSQL SSL enforcement required (ssl_enforcement_enabled must be true)",
  ],
];

// --- Terraform WARN-ONLY patterns ---
const TERRAFORM_WARNINGS = [
  [
    /default_action\s*=\s*"Allow"/i,
    "Key Vault network ACLs default action should be Deny, not Allow",
  ],
  [
    /allowed_origins\s*=\s*\[\s*"\*"\s*\]/i,
    "Wildcard CORS origin (*) should be restricted to specific domains",
  ],
];

/**
 * Scan a single file for security violations.
 */
function scanFile(filePath, violations, warningPatterns = []) {
  const relPath = path.relative(ROOT, filePath);
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  let fileHasViolation = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const [pattern, message] of violations) {
      if (pattern.test(line)) {
        fail(relPath, i + 1, message);
        fileHasViolation = true;
      }
    }
    for (const [pattern, message] of warningPatterns) {
      if (pattern.test(line)) {
        warn(relPath, i + 1, message);
      }
    }
  }

  // Check for duplicate tag keys differing only by casing
  checkTagCasingDuplicates(relPath, content);

  if (!fileHasViolation) {
    pass(`${relPath} — no security baseline violations`);
  }
  filesScanned++;
}

/**
 * Detect tag keys that differ only by casing (e.g. both Environment and environment).
 * Azure Policy treats case-variant tag keys as ambiguous evaluation paths.
 */
function checkTagCasingDuplicates(relPath, content) {
  const tagKeyPattern =
    /['"]?(Environment|ManagedBy|Project|Owner|environment|managedby|managedBy|project|owner)['"]?\s*[:=]/gi;
  const found = [];
  let match;
  while ((match = tagKeyPattern.exec(content)) !== null) {
    found.push(match[1]);
  }
  const seen = new Map();
  for (const key of found) {
    const lower = key.toLowerCase();
    if (seen.has(lower) && seen.get(lower) !== key) {
      fail(
        relPath,
        0,
        `Tag casing conflict: both '${seen.get(lower)}' and '${key}' found — Azure Policy treats case-variant tag keys as ambiguous (AmbiguousPolicyEvaluationPaths). Use PascalCase only.`,
      );
    }
    if (!seen.has(lower)) {
      seen.set(lower, key);
    }
  }
}

/**
 * Recursively find files matching a glob extension under a directory.
 */
function findFiles(dir, ext) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findFiles(fullPath, ext));
    } else if (entry.name.endsWith(ext)) {
      results.push(fullPath);
    }
  }
  return results;
}

// --- Main ---
console.log("\n🔒 IaC Security Baseline Validation\n");

// Scan Bicep files
const bicepDir = path.join(ROOT, "infra", "bicep");
const bicepFiles = findFiles(bicepDir, ".bicep");
if (bicepFiles.length > 0) {
  console.log(`📄 Scanning ${bicepFiles.length} Bicep file(s)...\n`);
  for (const f of bicepFiles) {
    scanFile(f, BICEP_VIOLATIONS, BICEP_WARNINGS);
  }
} else {
  console.log("ℹ️  No Bicep files found in infra/bicep/\n");
}

// Scan Terraform files
const tfDir = path.join(ROOT, "infra", "terraform");
const tfFiles = findFiles(tfDir, ".tf");
if (tfFiles.length > 0) {
  console.log(`\n📄 Scanning ${tfFiles.length} Terraform file(s)...\n`);
  for (const f of tfFiles) {
    scanFile(f, TERRAFORM_VIOLATIONS, TERRAFORM_WARNINGS);
  }
} else {
  console.log("ℹ️  No Terraform files found in infra/terraform/\n");
}

// --- Summary ---
console.log(
  `\n📊 Security baseline: ${checks} checks, ${filesScanned} files scanned`,
);
if (errors > 0) {
  console.error(`\n❌ ${errors} security baseline violation(s) found.`);
  console.error(
    "   Fix violations or document exceptions in 04-governance-constraints.md.\n",
  );
  process.exit(1);
}
if (warnings > 0) {
  console.log(`⚠️  ${warnings} warning(s) — review recommended.`);
}
console.log("✅ Security baseline validation passed.\n");
