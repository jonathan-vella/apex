<!-- ref:code-review-checklists-v1 -->

# Code Review — Project Checklists

Project-specific review checks for `code-quality.instructions.md`, which owns the priority
tiers, comment format and generic security list. General clean-code, testing and performance
practice is assumed; review against the repository contracts below.

## Security and Azure Baseline

- [ ] No secrets, tokens, keys or PII in code, logs, samples or diagrams; examples read
      values from parameters or environment variables
- [ ] IaC meets the [security baseline](iac-security-baseline.md) and
      [policy compliance](iac-policy-compliance.md) rules (TLS 1.2, HTTPS-only, managed
      identity, private PaaS data services, private DNS); `npm run validate:iac-security-baseline`
- [ ] Discovered Deny policies in `04-governance-constraints.json` are satisfied
- [ ] Mutating Azure, Kubernetes or Entra commands in scripts require explicit approval and
      default to dry-run or preview

## Validators and Tooling

- [ ] Validator logic is exported and returns a result; only the guarded CLI entrypoint exits
- [ ] An explicit path that matches no files fails instead of passing with zero files
- [ ] Shared helpers in `tools/scripts/_lib/` are reused (frontmatter, JSON/JSONC, reporter)
- [ ] Committed shell snippets pass `npm run lint:safe-shell` (no interactive flags, no shell
      writes to `agent-output/**`, guarded optional CLIs)

## Tests

- [ ] Behavior changes add or update focused tests (`node --test tools/tests/...`,
      `pytest` for Python tooling)
- [ ] Wording that tests assert on (agent, instruction and skill phrases) is preserved or the
      assertion is updated deliberately in the same change, never weakened
- [ ] `npm run validate:all` results are reported, including known pre-existing failures

## Agents, Skills and Instructions

- [ ] `npm run validate:agents` and `npm run lint:vendor-prompting` pass after agent/prompt edits
- [ ] No hard-coded entity counts (`npm run validate:no-hardcoded-counts`)
- [ ] Documentation triggers in `docs-trigger.instructions.md` are applied
- [ ] Moved content keeps working links and `<!-- ref:{slug}-v1 -->` markers in skill references

## IaC

- [ ] Bicep: `bicep build` and `bicep lint` pass; AVM modules use exact pins
- [ ] Terraform: `terraform fmt -check` and `npm run validate:terraform` pass; provider range
      `>= 4.0.0, < 5.0.0` and exact AVM module versions
- [ ] No hard-coded project values; names use the shared unique suffix
