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
 * 5. Azure AD-only SQL auth
 * 6. No shared key access on storage
 * 7. App Service HTTP/2 enabled
 * 8. MySQL/PostgreSQL SSL enforcement
 * 9. Container Registry admin user disabled
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
import { Reporter } from "./_lib/reporter.mjs";
import { walkFiles } from "./_lib/glob-helpers.mjs";
import { findAllMatches } from "./_lib/regex-helpers.mjs";

const ROOT = process.cwd();
const r = new Reporter("IaC Security Baseline");

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
  // --- MUST-FAIL: MySQL/PostgreSQL SSL ---
  [
    /sslEnforcement\s*:\s*'Disabled'/i,
    "MySQL/PostgreSQL SSL enforcement required (sslEnforcement must be Enabled)",
  ],
  // --- MUST-FAIL: Storage shared key access ---
  [
    /allowSharedKeyAccess\s*:\s*true/i,
    "Storage shared key access must be disabled (allowSharedKeyAccess must be false) — use Entra ID auth",
  ],
  // --- MUST-FAIL: App Service HTTP/2 ---
  [
    /http20Enabled\s*:\s*false/i,
    "App Service HTTP/2 should be enabled (http20Enabled must be true)",
  ],
  // --- MUST-FAIL: Container Registry admin user ---
  [
    /adminUserEnabled\s*:\s*true/i,
    "Container Registry admin user must be disabled — use managed identity",
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
  [
    /defaultToOAuthAuthentication\s*:\s*false/i,
    "Storage should default to Entra ID auth (defaultToOAuthAuthentication should be true)",
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
  // --- MUST-FAIL: MySQL/PostgreSQL SSL ---
  [
    /ssl_enforcement_enabled\s*=\s*false/i,
    "MySQL/PostgreSQL SSL enforcement required (ssl_enforcement_enabled must be true)",
  ],
  // --- MUST-FAIL: Storage shared key access ---
  [
    /shared_access_key_enabled\s*=\s*true/i,
    "Storage shared key access must be disabled — use Entra ID auth",
  ],
  // --- MUST-FAIL: App Service HTTP/2 ---
  [
    /http2_enabled\s*=\s*false/i,
    "App Service HTTP/2 should be enabled (http2_enabled must be true)",
  ],
  // --- MUST-FAIL: Container Registry admin user ---
  [
    /admin_enabled\s*=\s*true/i,
    "Container Registry admin user must be disabled — use managed identity",
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
  [
    /default_to_oauth_authentication\s*=\s*false/i,
    "Storage should default to Entra ID auth (default_to_oauth_authentication should be true)",
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
        r.error(`${relPath}:${i + 1}`, message);
        fileHasViolation = true;
      }
    }
    for (const [pattern, message] of warningPatterns) {
      if (pattern.test(line)) {
        r.warn(`${relPath}:${i + 1}`, message);
      }
    }
  }

  checkTagCasingDuplicates(relPath, content);

  if (!fileHasViolation) {
    r.ok(`${relPath} — no security baseline violations`);
  }
  r.tick();
}

/**
 * Detect tag keys that differ only by casing (e.g. both Environment and environment).
 * Azure Policy treats case-variant tag keys as ambiguous evaluation paths.
 */
function checkTagCasingDuplicates(relPath, content) {
  const tagKeyPattern =
    /['"]?(Environment|ManagedBy|Project|Owner|environment|managedby|managedBy|project|owner)['"]?\s*[:=]/gi;
  const found = findAllMatches(tagKeyPattern, content).map((m) => m[1]);
  const seen = new Map();
  for (const key of found) {
    const lower = key.toLowerCase();
    if (seen.has(lower) && seen.get(lower) !== key) {
      r.error(
        relPath,
        `Tag casing conflict: both '${seen.get(lower)}' and '${key}' found — Azure Policy treats case-variant tag keys as ambiguous (AmbiguousPolicyEvaluationPaths). Use PascalCase only.`,
      );
    }
    if (!seen.has(lower)) {
      seen.set(lower, key);
    }
  }
}

/**
 * Recursively find files matching an extension under a directory.
 * @deprecated Use walkFiles from _lib/glob-helpers.mjs for new code.
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
r.header();

// Scan Bicep files
const bicepFiles = walkFiles("infra/bicep", ".bicep");
if (bicepFiles.length > 0) {
  console.log(`📄 Scanning ${bicepFiles.length} Bicep file(s)...\n`);
  for (const f of bicepFiles) {
    scanFile(path.resolve(f), BICEP_VIOLATIONS, BICEP_WARNINGS);
  }
} else {
  console.log("ℹ️  No Bicep files found in infra/bicep/\n");
}

// Scan Terraform files
const tfFiles = walkFiles("infra/terraform", ".tf");
if (tfFiles.length > 0) {
  console.log(`\n📄 Scanning ${tfFiles.length} Terraform file(s)...\n`);
  for (const f of tfFiles) {
    scanFile(path.resolve(f), TERRAFORM_VIOLATIONS, TERRAFORM_WARNINGS);
  }
} else {
  console.log("ℹ️  No Terraform files found in infra/terraform/\n");
}

// --- Summary ---
r.summary("Security baseline");
r.exitOnError(
  "Security baseline validation passed.",
  `${r.errors} security baseline violation(s) found. Fix violations or document exceptions in 04-governance-constraints.md.`,
);
