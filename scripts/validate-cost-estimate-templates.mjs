import fs from "node:fs";
import path from "node:path";

const CORE_HEADINGS = [
  "## 💰 Cost At-a-Glance",
  "## ✅ Decision Summary",
  "## 🔁 Requirements → Cost Mapping",
  "## 📊 Top 5 Cost Drivers",
  "## Architecture Overview",
  "## 🧾 What We Are Not Paying For (Yet)",
  "## ⚠️ Cost Risk Indicators",
  "## 🎯 Quick Decision Matrix",
  "## 💰 Savings Opportunities",
  "## Detailed Cost Breakdown",
];

const REQUIRED_MERMAID_INIT =
  "%%{init: {'theme':'base','themeVariables':{pie1:'#0078D4',pie2:'#107C10',pie3:'#5C2D91',pie4:'#D83B01',pie5:'#FFB900'}}}%%";

const TITLE_DRIFT = "Cost Estimate Drift";
const TITLE_MISSING_AB = "Missing As-Built Examples";

const AGENT_DES = ".github/agents/architect.agent.md";
const AGENT_AB = ".github/skills/azure-workload-docs/SKILL.md";

const TEMPLATE_DES = ".github/templates/03-des-cost-estimate.template.md";
const TEMPLATE_AB = ".github/templates/07-ab-cost-estimate.template.md";

const STANDARD_DOC = ".github/instructions/cost-estimate.instructions.md";

let hasHardFailure = false;

function escapeGitHubCommandValue(value) {
  return value
    .replaceAll("%", "%25")
    .replaceAll("\r", "%0D")
    .replaceAll("\n", "%0A");
}

function annotate(level, { title, filePath, line, message }) {
  const parts = [];
  if (filePath) parts.push(`file=${filePath}`);
  if (line) parts.push(`line=${line}`);
  if (title) parts.push(`title=${escapeGitHubCommandValue(title)}`);

  const props = parts.length > 0 ? ` ${parts.join(",")}` : "";
  const body = escapeGitHubCommandValue(message);
  process.stdout.write(`::${level}${props}::${body}\n`);
}

function warn(message, { title = TITLE_DRIFT, filePath, line } = {}) {
  annotate("warning", { title, filePath, line, message });
}

function error(message, { title = TITLE_DRIFT, filePath, line } = {}) {
  annotate("error", { title, filePath, line, message });
  hasHardFailure = true;
}

function readText(relPath) {
  const absPath = path.resolve(process.cwd(), relPath);
  return fs.readFileSync(absPath, "utf8");
}

function exists(relPath) {
  return fs.existsSync(path.resolve(process.cwd(), relPath));
}

function extractH2Headings(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.startsWith("## "));
}

function extractFencedBlocks(text) {
  const lines = text.split(/\r?\n/);
  const blocks = [];

  let inFence = false;
  let fence = "";
  let current = [];

  for (const line of lines) {
    if (!inFence) {
      const openMatch = line.match(/^(`{3,})[^`]*$/);
      if (openMatch) {
        inFence = true;
        fence = openMatch[1];
        current = [];
      }
      continue;
    }

    if (line.startsWith(fence)) {
      blocks.push(current.join("\n"));
      inFence = false;
      fence = "";
      current = [];
      continue;
    }

    current.push(line);
  }

  return blocks;
}

function validateTemplate(relPath) {
  if (!exists(relPath)) {
    error(`Missing template file: ${relPath}`, { filePath: relPath, line: 1 });
    return;
  }

  const text = readText(relPath);
  const h2 = extractH2Headings(text);
  const coreFound = h2.filter((h) => CORE_HEADINGS.includes(h));

  if (coreFound.length !== CORE_HEADINGS.length) {
    error(
      `Template ${relPath} is missing one or more required core H2 headings.`,
      { filePath: relPath, line: 1 },
    );
  } else {
    for (let i = 0; i < CORE_HEADINGS.length; i += 1) {
      if (coreFound[i] !== CORE_HEADINGS[i]) {
        error(
          `Template ${relPath} core headings are out of order. Expected '${
            CORE_HEADINGS[i]
          }' at position ${i + 1}.`,
          { filePath: relPath, line: 1 },
        );
        break;
      }
    }
  }

  const extraH2 = h2.filter((h) => !CORE_HEADINGS.includes(h));
  if (extraH2.length > 0) {
    warn(
      `Template ${relPath} contains extra H2 headings beyond the core contract: ${extraH2.join(
        " | ",
      )}`,
      { filePath: relPath, line: 1 },
    );
  }

  if (!text.includes(REQUIRED_MERMAID_INIT)) {
    error(
      `Template ${relPath} is missing the required colored Mermaid pie init line.`,
      { filePath: relPath, line: 1 },
    );
  }

  if (!text.includes("pie showData")) {
    error(
      `Template ${relPath} is missing 'pie showData' in the Mermaid pie section.`,
      { filePath: relPath, line: 1 },
    );
  }
}

function validateAgentLinks() {
  if (!exists(AGENT_DES)) {
    error(`Missing agent file: ${AGENT_DES}`, { filePath: AGENT_DES, line: 1 });
  }
  if (!exists(AGENT_AB)) {
    error(`Missing agent file: ${AGENT_AB}`, { filePath: AGENT_AB, line: 1 });
  }

  const desText = exists(AGENT_DES) ? readText(AGENT_DES) : "";
  const abText = exists(AGENT_AB) ? readText(AGENT_AB) : "";

  if (
    exists(AGENT_DES) &&
    !desText.includes("../templates/03-des-cost-estimate.template.md")
  ) {
    error(
      `Agent ${AGENT_DES} must link to ../templates/03-des-cost-estimate.template.md`,
      { filePath: AGENT_DES, line: 1 },
    );
  }

  if (
    exists(AGENT_AB) &&
    !abText.includes("../templates/07-ab-cost-estimate.template.md")
  ) {
    error(
      `Agent ${AGENT_AB} must link to ../templates/07-ab-cost-estimate.template.md`,
      { filePath: AGENT_AB, line: 1 },
    );
  }
}

function validateNoEmbeddedSkeletons(relPath) {
  if (!exists(relPath)) return;

  const text = readText(relPath);

  if (text.includes("Cost Estimate File Structure")) {
    error(
      `Agent ${relPath} contains 'Cost Estimate File Structure' (embedded skeleton drift risk).`,
      {
        filePath: relPath,
        line: 1,
      },
    );
  }

  const blocks = extractFencedBlocks(text);
  const needles = [
    "# Azure Cost Estimate:",
    "# As-Built Cost Estimate:",
    ...CORE_HEADINGS,
  ];

  for (const block of blocks) {
    const hit = needles.find((needle) => block.includes(needle));
    if (hit) {
      error(
        `Agent ${relPath} appears to embed a cost-estimate skeleton inside a fenced block (found '${hit}').`,
        { filePath: relPath, line: 1 },
      );
      return;
    }
  }
}

function validateStandardsReference() {
  if (!exists(STANDARD_DOC)) {
    error(`Missing standards file: ${STANDARD_DOC}`, {
      filePath: STANDARD_DOC,
      line: 1,
    });
    return;
  }

  const text = readText(STANDARD_DOC);
  const requiredRefs = [TEMPLATE_DES, TEMPLATE_AB];

  for (const ref of requiredRefs) {
    if (!text.includes(ref)) {
      error(`Standards file must reference ${ref}`, {
        filePath: STANDARD_DOC,
        line: 1,
      });
    }
  }
}

function findAsBuiltExamples() {
  const baseDir = path.resolve(process.cwd(), "agent-output");
  if (!fs.existsSync(baseDir)) return [];

  const matches = [];
  const stack = [baseDir];

  while (stack.length > 0) {
    const dir = stack.pop();
    if (!dir) break;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile() && entry.name === "07-ab-cost-estimate.md") {
        matches.push(path.relative(process.cwd(), full));
      }
    }
  }

  return matches;
}

function main() {
  validateTemplate(TEMPLATE_DES);
  validateTemplate(TEMPLATE_AB);

  validateAgentLinks();
  validateNoEmbeddedSkeletons(AGENT_DES);
  validateNoEmbeddedSkeletons(AGENT_AB);

  validateStandardsReference();

  const abExamples = findAsBuiltExamples();
  if (abExamples.length === 0) {
    warn(
      "No agent-output/**/07-ab-cost-estimate.md examples found yet (warning-only).",
      { title: TITLE_MISSING_AB },
    );
  }

  if (hasHardFailure) {
    process.exit(1);
  }
}

main();
