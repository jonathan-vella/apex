# Astro Docs Review — 2026-05-21

Single deep-reviewer audit of `site/src/content/docs/` (69 pages on disk; 68
reachable via sidebar after orphans counted). Report-only run —
`--apply-fixes` was **not** supplied, so no files were modified.

> **Audit-trail note:** `logs/copilot/docs-review/` is currently inside the
> `logs/` ignore rule (`.gitignore:35`). To commit this report and the JSON
> findings, add the un-ignore line `!logs/copilot/docs-review/` after the
> `logs/` entry. The report still writes regardless.

## 1. Summary

| Severity      | Count |
| ------------- | ----- |
| `blocker`     | 1     |
| `major`       | 9     |
| `minor`       | 6     |
| `nit`         | 1     |
| `ia:proposal` | 3     |
| **Total**     | **20** |

### Top 5 must-fix

1. **[blocker]** `concepts/workflow-deep-dive.md` — 15 broken relative
   links climb the wrong directory (`how-it-works/...` instead of
   `../how-it-works/...`). This is the bulk of the link-check failure.
2. **[major]** `reference/architecture-explorer.mdx` — broken
   `/architecture-explorer.html` and `../concepts/how-it-works/...`
   links (wrong base + insufficient `../`).
3. **[major]** `concepts/how-it-works/workflow-engine.md` — `./agents/`
   resolves under itself; needs `../agents/`.
4. **[major]** Orphan pages: `getting-started/azure-setup.md` and
   `concepts/how-it-works/sku-manifest.md` exist but are missing from
   the sidebar — Azure setup is critical onboarding content.
5. **[major]** Six active-guidance pages still use `Azure AD` / `AAD`
   in prose (security-baseline, troubleshooting, prompt-guide
   best-practices, azure-setup, glossary). Replace with
   `Microsoft Entra ID`; keep code identifiers and `AZURE_TENANT_ID`
   variable names unchanged.

## 2. Findings by Category

### 2.1 Completeness

- `demo/08-as-built/compliance.md:111-113` — three `Todo` rows in the
  action table. Acceptable for the demo as-built but warrants a leading
  sentence clarifying they are intentional placeholders. *(minor)*
- No `TKTK`, `FIXME`, or `XXX` markers found outside the above.
- No sidebar entries point at missing files (sidebar → file is clean).

### 2.2 Accuracy

- Computed counts from `tools/registry/count-manifest.json`:
  primary_agents 15, subagents 7, skills 33, instructions 31,
  golden_principles 10, vscode_prompts 3.
- Docs do **not** hard-code any of these numbers — `grep` for
  `\b[0-9]+ (agents|subagents|skills|instructions|prompts|validators)\b`
  returned zero hits across `site/src/content/docs/`. Pass on the
  no-hardcoded-counts rule.
- Demo runbook commands and `az login` references are runnable on a
  configured dev container.

### 2.3 Errors

`node site/check-links.mjs` → **FAIL (18 broken links / 5032 total)**.
Distribution:

| Source page                                          | Broken | Root cause                              |
| ---------------------------------------------------- | ------ | --------------------------------------- |
| `concepts/workflow-deep-dive.md`                     | 15     | Missing `../` prefix on relative links  |
| `reference/architecture-explorer.mdx`                | 2      | Wrong base + insufficient `../` depth   |
| `concepts/how-it-works/workflow-engine.md`           | 1      | `./agents/` resolves under self         |

`npm run lint:md` → **PASS** (153 files, 0 errors).
`cd site && npm run build` → **PASS** (69 pages, 7.61s, all internal
links valid per Astro's internal checker — `check-links.mjs` is stricter
because it follows the deployed base path).

No malformed Starlight admonitions (`:::note` / `:::tip` etc.) and no
MkDocs-style `!!! note` blocks found. MDX parses clean for all 5 files.

### 2.4 Grammar

No grammar findings rise above noise for this pass. Allow-listed
auto-fixes were not exercised because `--apply-fixes` was not set.

### 2.5 Visuals

- No `![]()` (empty alt text) occurrences in `.md`/`.mdx` sources.
- No screenshot files matched the staleness regex
  `screenshot|ui-|capture|portal-` under `site/src/assets/` or
  `site/public/images/`, so the `--screenshot-age-months 4` rule
  yielded zero findings (the asset folders are dominated by Azure
  architecture diagrams and the Pastizzeria demo logo, both
  exempted by the regex).
- Mermaid blocks parse via `npm run build` (Astro fails the build on
  Mermaid syntax errors). Build is green.

### 2.6 Terminology

| File                                                            | Line(s)       | Issue                                  | Replace with                              |
| --------------------------------------------------------------- | ------------- | -------------------------------------- | ----------------------------------------- |
| `guides/security-baseline.md`                                   | 20            | `Azure AD-only SQL auth`               | `Microsoft Entra ID-only SQL auth`        |
| `guides/troubleshooting.md`                                     | 186           | `"Azure AD only"` / `AAD auth`         | `"Microsoft Entra ID only"` / `Entra ID auth` |
| `guides/prompt-guide/best-practices.md`                         | 69            | `Azure AD only`                        | `Microsoft Entra ID only`                 |
| `getting-started/azure-setup.md`                                | 35, 60        | `Azure AD admin`, `Azure AD tenant ID` | `Microsoft Entra ID admin`, `Microsoft Entra tenant ID` |
| `reference/glossary.md`                                         | 17, 21, 333   | Glossary lemma is `AAD`                | Lead with `Microsoft Entra ID (formerly AAD)`; line 529 table row keeps `AAD` as legacy abbreviation (exempt) |
| `getting-started/quickstart.md`                                 | 64            | `Click the green "Use this template"`  | `Select the green **Use this template** button` |
| `getting-started/dev-containers.md`                             | 147           | `Click the **Open Settings (JSON)**`   | `Select the **Open Settings (JSON)** icon` |
| `guides/apex-debug-log-export.md`                               | 100           | `Right-click ... and choose`           | `Right-click ... and select` *(nit)*      |

Code identifiers — `azureADOnlyAuthentication`,
`azuread_authentication_only`, `az login`, `azd auth login`,
`AZURE_TENANT_ID` — are stable variable/property names and are **not**
flagged.

Lines containing `log in` / `login` only inside fenced code blocks (`az
login`, `azd auth login`, `gh auth login`) are code identifiers and are
excluded.

### 2.7 Site standard alignment

- Frontmatter `title:` is present on every page → Starlight renders the
  H1 from frontmatter; "single H1" rule is satisfied. (The naïve
  `^#` grep flags shell comments and code blocks; false positive.)
- Admonition syntax uses `:::note` / `:::tip` consistently
  (153 occurrences). No `!!!` MkDocs-style blocks remain.
- Trailing-slash internal links are consistent.
- No hard-coded entity counts in prose (see §2.2).

### 2.8 Information Architecture

See full section below — three `ia:proposal` findings plus two
`major` orphans already counted under §2.1 / §2.2.

## 3. Information Architecture

### 3.1 Current sidebar vs target Diátaxis IA

| Current sidebar group | Pages | Mixed intent? | Target Diátaxis bucket                       |
| --------------------- | ----- | ------------- | -------------------------------------------- |
| Getting Started       | 2     | No (tutorial) | **Tutorials**                                |
| Concepts → How It Works | 7   | No (explanation) | **Explanation**                            |
| Concepts → Workflow Deep Dive | 1 | No (explanation) | **Explanation** — but should split per step |
| Guides → Prompt Guide | 5     | **Yes** (tutorial + reference) | Split between **Tutorials** and **Reference** |
| Guides (top-level)    | 9     | **Yes** (how-to + reference + explanation) | Split between **How-to** and **Reference** |
| Reference             | 5     | No            | **Reference**                                |
| Project               | 3     | No            | (Project meta — leave as-is)                 |
| Demo                  | 30+   | No (worked example) | **Tutorials → walked example**         |

### 3.2 Per-page intent classification (top-level non-demo pages)

| Page                                                 | Diátaxis intent | In sidebar? |
| ---------------------------------------------------- | --------------- | ----------- |
| `getting-started/quickstart.md`                      | Tutorial        | Yes         |
| `getting-started/dev-containers.md`                  | Tutorial        | Yes         |
| `getting-started/azure-setup.md`                     | Tutorial        | **No — orphan** |
| `concepts/how-it-works/index.mdx`                    | Explanation     | Yes         |
| `concepts/how-it-works/architecture.md`              | Explanation     | Yes         |
| `concepts/how-it-works/four-pillars.md`              | Explanation     | Yes         |
| `concepts/how-it-works/agents.md`                    | Explanation     | Yes         |
| `concepts/how-it-works/skills-and-instructions.md`   | Explanation     | Yes         |
| `concepts/how-it-works/workflow-engine.md`           | Explanation     | Yes         |
| `concepts/how-it-works/mcp-integration.md`           | Explanation     | Yes         |
| `concepts/how-it-works/sku-manifest.md`              | Explanation     | **No — orphan** |
| `concepts/workflow.md`                               | Explanation     | Yes         |
| `concepts/workflow-deep-dive.md`                     | Explanation     | Yes         |
| `guides/prompt-guide/index.mdx`                      | Tutorial        | Yes         |
| `guides/prompt-guide/best-practices.md`              | Reference       | Yes         |
| `guides/prompt-guide/workflow-prompts.md`            | Reference       | Yes         |
| `guides/prompt-guide/repository-prompts.md`          | Reference       | Yes         |
| `guides/prompt-guide/reference.md`                   | Reference       | Yes         |
| `guides/troubleshooting.md`                          | How-to          | Yes         |
| `guides/session-debugging.md`                        | How-to          | Yes         |
| `guides/apex-debug-log-export.md`                    | How-to          | Yes         |
| `guides/devcontainer-hygiene.md`                     | How-to          | Yes         |
| `guides/security-baseline.md`                        | Reference       | Yes (in Guides — misplaced) |
| `guides/cost-governance.md`                          | Reference       | Yes (in Guides — misplaced) |
| `guides/azd-deployment.mdx`                          | How-to          | Yes         |
| `guides/hooks.md`                                    | How-to          | Yes         |
| `guides/e2e-testing.md`                              | How-to          | Yes         |
| `reference/faq.md`                                   | Reference       | Yes         |
| `reference/validation-reference.md`                  | Reference       | Yes         |
| `reference/architecture-explorer.mdx`                | Reference       | Yes         |
| `reference/glossary.md`                              | Reference       | Yes         |
| `reference/resources.md`                             | Reference       | Yes         |

### 3.3 Orphans (file → not in sidebar)

- `site/src/content/docs/getting-started/azure-setup.md`
- `site/src/content/docs/concepts/how-it-works/sku-manifest.md`

Recommended new pages:

- `getting-started/your-first-run.md` — happy-path tutorial walking the
  demo project through Steps 1→7 with checkpoints. Pairs with the
  Minimal-S path.
- `concepts/workflow/step-{1,2,3,3.5,4,5,6,7}.md` — one page per
  workflow step. Pairs with the Full-L path.

### 3.4 Two paths

#### Minimal viable IA — T-shirt size **S** (≤ 1 day)

Goal: fix the navigation breaks without restructuring content.

1. Add the two orphans (`azure-setup`, `sku-manifest`) to the sidebar
   under their natural groups.
2. Fix the 18 broken links (one file dominates: `workflow-deep-dive.md`).
3. Add `getting-started/your-first-run.md` as a short tutorial that
   chains existing pages with explicit "next step" links.
4. Rename the `Guides` sidebar label to `How-to & Tutorials` to signal
   the mixed intent honestly without moving files.
5. Apply the terminology table in §2.6.

#### Full Diátaxis migration — T-shirt size **L** (≥ 1 week)

Goal: clean separation of tutorial / how-to / reference / explanation.

1. **Start here** (Tutorials) — `quickstart`, `azure-setup`,
   `dev-containers`, `your-first-run` (new).
2. **Understand APEX** (Explanation, conceptual) — move
   `concepts/how-it-works/*` here; keep page set intact.
3. **Walk the workflow** (Explanation, step spine, NEW) — one page per
   step: 1, 2, 3, 3.5, 4, 5, 6, 7, Post. Each page ~200 lines, identical
   `Step N — <Name>` heading, cross-links to How-to and Reference.
   Retire `concepts/workflow.md` and `concepts/workflow-deep-dive.md`
   by migrating their content into the per-step pages.
4. **How-to guides** (task-oriented, flat) — `troubleshooting`,
   `session-debugging`, `apex-debug-log-export`, `devcontainer-hygiene`,
   `azd-deployment`, `hooks`, `e2e-testing` (and the demo cluster as a
   worked example).
5. **Reference** — keep `faq`, `validation-reference`,
   `architecture-explorer`, `glossary`, `resources`; **move**
   `security-baseline`, `cost-governance` here; **move** the four
   `prompt-guide/*` pages that are reference-shaped under
   `reference/prompts/`.
6. **Project** — unchanged.

Enforce `Step N` terminology consistently across the new layout
(see finding on `Phase` vs `Step` in §2.6 / agents.md:134).

## 4. Files Auto-Fixed

Not applicable — `--apply-fixes` was not supplied. No files were
modified during this run.

## 5. Verification

| Check                                       | Result | Notes                                   |
| ------------------------------------------- | ------ | --------------------------------------- |
| `npm run lint:md`                           | ✅ PASS | 153 files, 0 errors                     |
| `node site/check-links.mjs`                 | ❌ FAIL | 18 broken / 5032 total (see §2.3)       |
| `cd site && npm run build`                  | ✅ PASS | 69 pages built in 7.61s                 |

Full logs:

- `logs/copilot/docs-review/2026-05-21/lint-md.log`
- `logs/copilot/docs-review/2026-05-21/check-links.log`
- `logs/copilot/docs-review/2026-05-21/build.log`

## 6. Terminology Decisions Appendix

| Term encountered                  | Decision                                                                                                     | Rationale |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------ | --------- |
| `Azure AD` / `AAD` in prose       | Replace with `Microsoft Entra ID`                                                                            | Microsoft Cloud Style Guide — Azure AD was renamed Microsoft Entra ID (Jul 2023). |
| `azureADOnlyAuthentication`, `azuread_authentication_only` | Keep — code identifiers / property names                                  | Stable API surface; renaming would break templates. |
| `AZURE_TENANT_ID` (secret/var)    | Keep — variable name                                                                                          | Established convention; only update the human-readable description ("Microsoft Entra tenant ID"). |
| `az login`, `azd auth login`, `gh auth login` | Keep — CLI commands                                                                              | Verbatim shell commands; never rewritten. |
| `Click the **X** button` (UI verb)| Replace with `Select the **X** button`                                                                       | Microsoft Cloud Style Guide — `select` is the device-neutral UI verb. |
| `Right-click ... choose`          | Keep `Right-click` (canonical mouse gesture), change `choose` → `select` for consistency                     | Style guide allows `right-click` as a gesture name. |
| Glossary entry `### AAD (Azure Active Directory)` | Rewrite headline; preserve `AAD` as legacy abbreviation in the table row at line 529                         | Glossary must lead with the current brand; legacy aliases are still searchable via the abbreviation column (exempt by `formerly`/`renamed` rule). |
| `Step N` vs `Phase N`             | `Step N` is the workflow spine; `Phase N` is a sub-stage inside an agent (e.g. `Architect Phase 6b`). Flag mixed usage; do not auto-fix. | Prompt invariant + repo `AGENTS.md` workflow table. |
| `Powershell` typo                 | No occurrences found in `site/src/content/docs/`                                                              | — |
| `github` lowercase                | Only matches were `github.copilot.chat...` VS Code setting keys (config identifier) → keep                   | Setting keys are case-sensitive identifiers. |
