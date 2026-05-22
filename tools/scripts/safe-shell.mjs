#!/usr/bin/env node
/**
 * safe-shell.mjs
 *
 * Documentation-aid linter that catches forbidden interactive-shell
 * patterns committed to agent, prompt, instruction, skill, AGENTS.md,
 * and README files. The primary control is
 * `.github/instructions/no-interactive-shell.instructions.md`; this
 * script enforces the same rules in committed snippets so they don't
 * drift back in via copy-paste.
 *
 * Forbidden patterns:
 *   - `mv -i`, `rm -i`, `cp -i` (incl. inside `bash -c '...'`)
 *   - `read -p`
 *   - `confirm` shell prompts
 *
 * Usage: node tools/scripts/safe-shell.mjs
 * Exit codes: 0 = clean, 1 = violations found
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(new URL("../..", import.meta.url).pathname);

// Files to scan. We mirror the applyTo glob from
// .github/instructions/no-interactive-shell.instructions.md so the linter
// stays in sync with the instruction file. Notably, skill `references/`
// folders are excluded — they hold longer-form templates (often standalone
// deploy scripts) that are not part of the auto-loaded chat context.
const SCAN_GLOBS = [
  // Agent + prompt + instruction files
  { dir: ".github/agents", suffix: ".md" },
  { dir: ".github/instructions", suffix: ".md" },
  { dir: "tools/apex-prompts", suffix: ".md" },
];
// For skills, only the canonical SKILL files (not nested references/).
const SKILL_FILE_NAMES = new Set(["SKILL.md"]);
const SCAN_ROOT_FILES = ["AGENTS.md", "README.md", ".github/copilot-instructions.md"];

// Each rule:
//   id: short rule id for the report
//   pattern: RegExp to match a forbidden snippet
//   why: short explanation
//   fix: what to do instead
//   context: optional. "set-e" = only flag when inside a fenced bash block
//            where `set -e` (or any `set -*e*` variant) has been emitted
//            earlier in the same fence. Default is unscoped (every line).
const RULES = [
  {
    id: "mv-interactive",
    pattern: /\bmv\s+(?:-[a-zA-Z]*i[a-zA-Z]*\b|--interactive\b)/,
    why: "mv -i prompts for confirmation, which hangs the chat turn",
    fix: "use mv -f or use the file tool to move via create_file/replace_string_in_file",
  },
  {
    id: "rm-interactive",
    pattern: /\brm\s+(?:-[a-zA-Z]*i[a-zA-Z]*\b|--interactive\b)/,
    why: "rm -i prompts for confirmation, which hangs the chat turn",
    fix: "use rm -f (or skip the rm and let the user clean up)",
  },
  {
    id: "cp-interactive",
    pattern: /\bcp\s+(?:-[a-zA-Z]*i[a-zA-Z]*\b|--interactive\b)/,
    why: "cp -i prompts for confirmation, which hangs the chat turn",
    fix: "use cp -f or use the file tool to copy via create_file",
  },
  {
    id: "read-prompt",
    pattern: /\bread\s+(?:-[a-zA-Z]*p[a-zA-Z]*\s+|--prompt\b)/,
    why: "read -p hangs waiting for stdin in a non-interactive context",
    fix: "use the vscode_askQuestions tool to gather user input",
  },
  {
    id: "bash-c-interactive",
    // bash -c '... -i ...' wrapping mv/rm/cp/read with -i flag
    pattern: /\bbash\s+-c\s+['"][^'"]*\b(?:mv|rm|cp|read)\b[^'"]*-i[^'"]*['"]/,
    why: "interactive flag inside bash -c '...' still hangs the chat turn",
    fix: "remove the -i flag; use -f or vscode_askQuestions instead",
  },
  {
    id: "grep-no-fallback-in-set-e",
    // Bare grep with at least one flag and at least one operand, NOT
    // piped (no `|` anywhere in the trailing args). Matches lines like
    // `grep -n 'pat' file.md` or `grep -c pat file 2>/dev/null` but
    // skips `grep ... | head`, `grep ... || true`, `grep ... || echo …`.
    pattern: /\bgrep\s+-[a-zA-Z]+\s+[^|]+$/,
    why: "grep returns exit 1 on no-match; under `set -e` this aborts the entire batch",
    fix: 'append `|| true`, `|| echo "<fallback>"`, or pipe to another command',
    context: "set-e",
  },
];

// Portability tools that should not be invoked bare in committed shell
// snippets. They are not guaranteed to be on the chat-agent PATH. Each
// must be either:
//   (a) guarded by a `command -v <tool>` check in the same fence, OR
//   (b) replaced by a stdlib fallback (`grep -R`, `find`, `python -m json.tool`).
// Rule id: command-portability (issue #425, Wave 2a).
const PORTABILITY_TOOLS = ["rg", "fd", "bat"]; // Match `<tool> ` as a command at the start of an executable position.
// We allow positions after `|`, `&&`, `||`, `;`, `$(`, `\``, control
// keywords (`then`, `else`, `do`, `xargs`, env-prefix `FOO=bar `).
// Concretely: word-boundary + tool + space/end, NOT preceded by `-`
// (avoid flag matches like `--rg`) and NOT preceded by `/` (avoid
// paths like `/usr/bin/rg` which are explicit).
function matchesBareTool(line, tool) {
  // Strip strings so we don't trip on `'rg'` inside descriptions.
  const stripped = line.replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""');
  // Position contexts where a command can start.
  const re = new RegExp(
    `(?:^|[|&;]|\\|\\||&&|\\$\\(|\`|\\bthen\\b|\\belse\\b|\\bdo\\b|\\bxargs\\b|\\b[A-Z_][A-Z0-9_]*=\\S+\\s+)\\s*${tool}(?:\\s|$)`,
  );
  // Absolute paths (`/usr/bin/rg`) are explicit invocations and not bare
  // tools. The character class above already excludes `/` as a preceding
  // separator, so any match here is a bare invocation.
  return re.test(stripped);
}

// Heredoc / tee writes to agent-output/** are runtime-corrupting in the
// VS Code Copilot chat surface (heredocs frequently lose escape handling
// and tee buffers stale state). Rule id: agent-output-no-heredoc
// (issue #425, Wave 2b). Detection is per-fence: any line in the fence
// that contains BOTH a heredoc/tee write AND a target matching
// agent-output/** is flagged.
const AGENT_OUTPUT_PATH = /agent-output\/[A-Za-z0-9_./*{}-]+/;
// Heredoc operator: `<<` or `<<-`, optionally with quoted or unquoted
// delimiter. We don't care which command precedes (cat/python/jq/etc.).
const HEREDOC_OP = /<<-?\s*['"]?[A-Za-z_][A-Za-z0-9_]*['"]?/;
// Redirection forms that write a file (excluding pure `<` read).
const REDIRECT_OP = /(?:>>?|&>|tee(?:\s+-a)?)\s+/;

const SKIP_FILE_NAMES = new Set([
  // The instruction file itself documents the forbidden patterns.
  "no-interactive-shell.instructions.md",
  // The no-heredoc instruction file references shell patterns too.
  "no-heredoc.instructions.md",
  // This script itself.
  "safe-shell.mjs",
]);

function shouldSkipPath(absPath) {
  const base = path.basename(absPath);
  if (SKIP_FILE_NAMES.has(base)) return true;
  return false;
}

function* walkScanDir(dir, suffix) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === "node_modules" ||
        entry.name === ".venv" ||
        entry.name === "venv" ||
        entry.name === "dist" ||
        entry.name === "build"
      ) {
        continue;
      }
      yield* walkScanDir(full, suffix);
    } else if (entry.isFile() && entry.name.endsWith(suffix)) {
      yield full;
    }
  }
}

function* walkSkillFiles(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip references/ and templates/ — they hold long-form material
      // not auto-loaded into chat context.
      if (entry.name === "references" || entry.name === "templates") continue;
      if (
        entry.name === "node_modules" ||
        entry.name === ".venv" ||
        entry.name === "venv" ||
        entry.name === "dist" ||
        entry.name === "build"
      ) {
        continue;
      }
      yield* walkSkillFiles(full);
    } else if (entry.isFile() && SKILL_FILE_NAMES.has(entry.name)) {
      yield full;
    }
  }
}

function collectFiles() {
  const files = new Set();
  for (const { dir, suffix } of SCAN_GLOBS) {
    const abs = path.join(ROOT, dir);
    for (const f of walkScanDir(abs, suffix)) files.add(f);
  }
  // Skill canonical files only.
  for (const f of walkSkillFiles(path.join(ROOT, ".github/skills"))) {
    files.add(f);
  }
  for (const rel of SCAN_ROOT_FILES) {
    const abs = path.join(ROOT, rel);
    if (fs.existsSync(abs)) files.add(abs);
  }
  return [...files].sort();
}

function lintFile(absPath) {
  if (shouldSkipPath(absPath)) return [];
  const findings = [];
  let content;
  try {
    content = fs.readFileSync(absPath, "utf8");
  } catch {
    return [];
  }
  const lines = content.split(/\r?\n/);
  // Track whether we are inside a fenced code block. Inside a fence the
  // patterns ARE intended as commands the agent might emit, so we lint them.
  // Outside a fence the patterns may appear in prose (inside backticks) as
  // *documentation* of forbidden patterns — those are exempt as long as they
  // sit inside inline code spans (`...`).
  let inFence = false;
  let fenceLang = "";
  // Per-fence context flag: did this bash block emit `set -e` (or any
  // `set -*e*` variant) earlier? Reset on every fence close.
  let setESeen = false;
  // Per-fence buffer of (line-number, line) tuples for shell-flavored
  // fences. Used for fence-scoped rules (e.g. command-portability) that
  // need full-fence context (guard may appear after invocation).
  let fenceBuffer = [];
  let fenceIsShell = false;
  lines.forEach((line, idx) => {
    const fenceOpen = line.match(/^\s*```([a-zA-Z0-9_-]*)\s*$/);
    if (fenceOpen) {
      if (inFence) {
        // Closing fence — run fence-scoped checks before resetting state.
        if (fenceIsShell) {
          findings.push(...portabilityFindings(fenceBuffer));
          findings.push(...agentOutputHeredocFindings(fenceBuffer));
        }
        inFence = false;
        fenceLang = "";
        setESeen = false;
        fenceBuffer = [];
        fenceIsShell = false;
      } else {
        inFence = true;
        fenceLang = fenceOpen[1].toLowerCase();
        setESeen = false;
        fenceBuffer = [];
        const SHELL_FENCES = new Set(["", "bash", "sh", "zsh", "shell", "console"]);
        fenceIsShell = SHELL_FENCES.has(fenceLang);
      }
      return;
    }
    // Build a "lint-eligible" version of the line. When outside a fence,
    // strip inline code spans (text inside backticks) — they are
    // documentation references, not commands.
    let toScan = line;
    if (!inFence) {
      toScan = line.replace(/`[^`]*`/g, "");
    }
    // Inside a fence, only scan shell-flavored fences. Other fences (json,
    // yaml, text, etc.) cannot be executed as shell commands.
    if (inFence) {
      const SHELL_FENCES = new Set(["", "bash", "sh", "zsh", "shell", "console"]);
      if (!SHELL_FENCES.has(fenceLang)) return;
      // Detect `set -e`, `set -euo pipefail`, `set +H && set -e`, etc.
      // Match any `set` with a `-` flag bundle containing `e`.
      if (/\bset\s+[-+][a-zA-Z]*e[a-zA-Z]*\b/.test(toScan)) {
        setESeen = true;
      }
      // Buffer for fence-scoped checks.
      fenceBuffer.push({ line: idx + 1, text: line, scan: toScan });
    }
    for (const rule of RULES) {
      if (rule.context === "set-e" && !(inFence && setESeen)) continue;
      if (rule.pattern.test(toScan)) {
        findings.push({
          rule: rule.id,
          line: idx + 1,
          snippet: line.trim().slice(0, 160),
          why: rule.why,
          fix: rule.fix,
        });
      }
    }
  });
  // If file ended while still inside a fence (malformed markdown), still
  // run portability checks on what we buffered.
  if (inFence && fenceIsShell) {
    findings.push(...portabilityFindings(fenceBuffer));
    findings.push(...agentOutputHeredocFindings(fenceBuffer));
  }
  return findings;
}

/**
 * Fence-scoped check for the command-portability rule (#425, Wave 2a).
 *
 * Input: array of { line, text, scan } objects covering one shell fence.
 * Output: findings array for any unguarded bare invocation of a
 * non-default tool (`rg`, `fd`, `bat`). A tool is considered guarded if
 * the same fence contains `command -v <tool>` anywhere (before or after
 * the invocation). Stdlib fallbacks (`grep -R`, `find`, `python -m
 * json.tool`) are accepted by author convention — we do not try to
 * detect them; we only require the guard OR absence of the bare call.
 */
function portabilityFindings(fenceBuffer) {
  const out = [];
  // Collect guards in this fence.
  const guarded = new Set();
  for (const { scan } of fenceBuffer) {
    for (const tool of PORTABILITY_TOOLS) {
      const guardRe = new RegExp(`\\bcommand\\s+-v\\s+${tool}\\b`);
      if (guardRe.test(scan)) guarded.add(tool);
    }
  }
  // Flag unguarded bare invocations.
  for (const { line, text, scan } of fenceBuffer) {
    for (const tool of PORTABILITY_TOOLS) {
      if (guarded.has(tool)) continue;
      if (!matchesBareTool(scan, tool)) continue;
      out.push({
        rule: "command-portability",
        line,
        snippet: text.trim().slice(0, 160),
        why: `${tool} is not on the default PATH for many chat-agent environments`,
        fix: `guard with \`command -v ${tool}\` in the same fence, or use a stdlib fallback (grep -R / find / python -m json.tool)`,
      });
    }
  }
  return out;
}

/**
 * Fence-scoped check for the agent-output-no-heredoc rule (#425, Wave 2b).
 *
 * Heredocs and tee writes to `agent-output/**` are runtime-corrupting in
 * the chat surface. Agents must use the file-editing tool (create_file
 * / replace_string_in_file / multi_replace_string_in_file) instead.
 *
 * Detection is fence-scoped (multi-line heredocs are common). We flag a
 * line when either:
 *   - it opens a heredoc (HEREDOC_OP matches) AND the same line OR a
 *     subsequent line in the fence contains an `agent-output/...` target
 *     in a write redirect (>, >>, &>, tee, tee -a); OR
 *   - it contains a redirect to `agent-output/...` (covers `tee` and
 *     `>`/`>>` without a heredoc).
 */
function agentOutputHeredocFindings(fenceBuffer) {
  const out = [];
  // Look for any agent-output write target anywhere in the fence.
  const writeTargets = []; // [{ line, text }]
  for (const entry of fenceBuffer) {
    const { line, text, scan } = entry;
    // Intentionally do NOT strip quoted strings before matching.
    // Redirects like `tee "agent-output/foo"` or `> "agent-output/foo"`
    // are still real writes to agent-output/** and must be flagged.
    if (AGENT_OUTPUT_PATH.test(scan) && REDIRECT_OP.test(scan)) {
      writeTargets.push({ line, text });
    }
  }
  // Detect heredocs in the fence regardless of agent-output target.
  // If a heredoc opens AND any write target points at agent-output/...,
  // flag the heredoc line (it's the destination of the heredoc body).
  const heredocLines = [];
  for (const { line, text, scan } of fenceBuffer) {
    if (HEREDOC_OP.test(scan)) heredocLines.push({ line, text, scan });
  }
  // Flag heredocs whose same-line redirect targets agent-output/...
  for (const hd of heredocLines) {
    if (AGENT_OUTPUT_PATH.test(hd.scan) && REDIRECT_OP.test(hd.scan)) {
      out.push({
        rule: "agent-output-no-heredoc",
        line: hd.line,
        snippet: hd.text.trim().slice(0, 160),
        why: "heredoc writes to agent-output/** are runtime-corrupting in chat surfaces",
        fix: "use the file-editing tool (create_file / replace_string_in_file) instead",
      });
    }
  }
  // Flag any redirect to agent-output/... that we haven't already flagged.
  const seen = new Set(out.map((f) => f.line));
  for (const wt of writeTargets) {
    if (seen.has(wt.line)) continue;
    out.push({
      rule: "agent-output-no-heredoc",
      line: wt.line,
      snippet: wt.text.trim().slice(0, 160),
      why: "shell redirects to agent-output/** bypass the file-editing tool contract",
      fix: "use the file-editing tool (create_file / replace_string_in_file) instead",
    });
  }
  return out;
}

function main() {
  const files = collectFiles();
  let totalViolations = 0;
  for (const file of files) {
    const findings = lintFile(file);
    if (findings.length === 0) continue;
    totalViolations += findings.length;
    const rel = path.relative(ROOT, file);
    console.error(`\n❌ ${rel}`);
    for (const f of findings) {
      console.error(`   Line ${f.line} [${f.rule}]: ${f.snippet}\n     why: ${f.why}\n     fix: ${f.fix}`);
    }
  }
  if (totalViolations === 0) {
    console.log(`✅ safe-shell: scanned ${files.length} files, 0 violations`);
    process.exit(0);
  }
  console.error(`\n❌ safe-shell: ${totalViolations} violation(s) across ${files.length} files`);
  console.error("   See .github/instructions/no-interactive-shell.instructions.md for the full ruleset.");
  process.exit(1);
}

// Export internals for fixture-based unit tests; only invoke main() when
// this file is the process entrypoint (`node tools/scripts/safe-shell.mjs`).
export { RULES, lintFile };

const invokedAsScript =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (invokedAsScript) {
  main();
}
