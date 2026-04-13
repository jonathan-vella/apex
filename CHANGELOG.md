<a id="top"></a>

# Changelog

All notable changes to **APEX** are documented in this file.

For the full release history, see:

- [Published Changelog](https://jonathan-vella.github.io/azure-agentic-infraops/project/changelog/)
- [GitHub Releases](https://github.com/jonathan-vella/azure-agentic-infraops/releases)
- [VERSION.md](VERSION.md)

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.10.0] — Unreleased

See the [published changelog](https://jonathan-vella.github.io/azure-agentic-infraops/project/changelog/)
for full details on this and all prior releases.

### Changed

- refactor(agents): reduce prompt-body duplication by trimming the largest deploy, architect,
  and E2E agents; extract shared deploy, codegen, placeholder-scan, and direct-execution
  protocols into reusable skill references; and raise the advisory large-agent context target
  from 300 to 350 body lines in repo guidance and validators.
- refactor(instructions): replace the monolithic IaC guidance with split Bicep, Terraform,
  and implementation-plan instruction files plus shared policy, security, and cost-monitoring
  references.
- refactor(docs): align repository docs and site docs with `.github/agents`,
  `.github/instructions`, and `.github/skills` as the single source of truth, including
  current subagent names and instruction filenames.
- feat(skills): update the `azure-deploy` skill so a missing `.azure/plan.md` automatically
  triggers the `azure-prepare` then `azure-validate` flow before deployment proceeds.
