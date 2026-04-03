## Description

<!-- Provide a brief description of your changes. What does this PR do? Why is it needed? -->

## Related Issue

<!-- Link to the related issue, e.g., "Fixes #123" or "Closes #456" -->

Fixes #

## Type of Change

<!-- Mark the appropriate option with an "x" -->

- [ ] 🆕 New prompt guide section
- [ ] 🏗️ New infrastructure module (Bicep/Terraform)
- [ ] 🤖 Agent definition update (.github/agents/)
- [ ] 📝 Documentation update
- [ ] 🐛 Bug fix
- [ ] 🔧 Refactoring (no functional changes)
- [ ] ⚙️ Configuration/workflow change
- [ ] 💰 MCP server enhancement (azure-pricing-mcp)

## Workflow Used

<!-- Which agent workflow was used to create these changes? -->

- [ ] Multi-step workflow: `@requirements` → `architect` → `iac-planner` → `bicep-code`
- [ ] Direct implementation (simple change)
- [ ] Copilot Coding Agent (autonomous)
- [ ] Manual implementation

## Changes Made

<!-- Describe the specific changes you made. Include file paths. -->

**Files added:**

- **Files modified:**

-

## Testing Performed

<!-- Describe how you tested your changes -->

### Infrastructure (if applicable)

- [ ] `bicep build` succeeds for all `.bicep` files
- [ ] `bicep lint` passes with no errors
- [ ] Deployed to Azure subscription (region: \***\*\_\_\_\_\*\***)
- [ ] All resources pass Azure Policy compliance
- [ ] Resources cleaned up after testing

### Code Quality

- [ ] Pre-commit hook passed (`npm run lint:md`)
- [ ] Agent YAML frontmatter validates
- [ ] MCP server tests pass (`pytest tests/`)

## Well-Architected Framework Alignment

<!-- For infrastructure changes, which WAF pillars were considered? -->

- [ ] 🛡️ Security (private endpoints, managed identity, TLS 1.2+)
- [ ] 🔄 Reliability (zone redundancy, backups, monitoring)
- [ ] 💰 Cost Optimization (right-sizing, auto-scaling)
- [ ] ⚡ Performance Efficiency (caching, CDN, scaling)
- [ ] 🔧 Operational Excellence (IaC, monitoring, alerts)

## Pre-Submission Checklist

<!-- Verify all items before requesting review -->

### PR Hygiene

- [ ] PR touches < 50 files (split larger changes into stacked PRs)
- [ ] All CI checks pass locally (`npm run validate:all`)
- [ ] Commit messages follow conventional commits format
- [ ] Review conversations resolved before requesting re-review

### Code Standards

- [ ] Region defaults to `swedencentral` (or `germanywestcentral`)
- [ ] Unique suffixes used for globally-unique resource names
- [ ] Resource names within length limits (Key Vault ≤24, Storage ≤24)
- [ ] Required tags included (Environment, ManagedBy, Project, Owner)
- [ ] No hardcoded secrets, subscription IDs, or sensitive data
- [ ] Uses Azure Verified Modules (AVM) where available

### Documentation

- [ ] README updated with any new features
- [ ] DEMO-SCRIPT.md included (for scenarios)
- [ ] Effective prompts documented
- [ ] Architecture diagram included (Python diagrams-as-code)
- [ ] Cost estimate provided (for significant infrastructure)

### Validation

- [ ] Markdown linting passes: `npm run lint:md`
- [ ] All internal links verified
- [ ] CI workflow passes
- [ ] CHANGELOG.md updated (for releases)

## Screenshots / Architecture Diagram

<!-- Add architecture diagrams or screenshots if applicable -->

## Additional Notes

<!-- Add any other context for reviewers -->

### Deployment Instructions (if applicable)

```bash
# Example deployment command
az deployment group create \
  --resource-group rg-project-dev \
  --template-file infra/bicep/project/main.bicep \
  --parameters environment=dev
```
