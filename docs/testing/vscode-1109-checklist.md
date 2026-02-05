# VS Code 1.109 Orchestration Testing Checklist

> Manual testing checklist for VS Code 1.109+ agent orchestration features.
> Run after rebuilding devcontainer or updating agent definitions.

---

## Prerequisites

| Requirement | Command/Check | Expected |
|-------------|---------------|----------|
| VS Code version | `code --version` | 1.109.0 or higher |
| Copilot extension | Extensions panel | GitHub.copilot installed |
| Copilot Chat | Extensions panel | GitHub.copilot-chat installed |
| Azure extension | Extensions panel | ms-azuretools.vscode-azure-github-copilot |
| Devcontainer rebuilt | Terminal output | "postCreateCommand completed" |

---

## Automated Validation

Run these before manual testing:

```bash
# Full 1.109 validation suite
npm run test:1109

# Individual checks
npm run validate:vscode    # VS Code settings
npm run validate:agents    # Agent frontmatter + skills
```

---

## Agent Discovery

| Test | Steps | Expected | Status |
|------|-------|----------|--------|
| Agent dropdown shows all agents | `Ctrl+Shift+A` → View dropdown | 8 agents visible | ☐ |
| InfraOps Conductor visible | Check dropdown | "InfraOps Conductor" appears | ☐ |
| Subagents hidden | Check dropdown | No "lint", "whatif", "review" subagents | ☐ |
| Agent descriptions | Hover over agent | Description tooltip appears | ☐ |

### Expected Agents (8)

| Agent | Persona | user-invokable |
|-------|---------|----------------|
| InfraOps Conductor | Maestro | true |
| Requirements | Scribe | true |
| Architect | Oracle | true |
| Design | Artisan | true |
| Bicep Plan | Strategist | true |
| Bicep Code | Forge | true |
| Deploy | Envoy | true |
| Diagnose | Sentinel | true |

---

## Skill Discovery

| Test | Steps | Expected | Status |
|------|-------|----------|--------|
| Skills load | Open Copilot Chat | No skill loading errors | ☐ |
| Skill invocation | `/azure-diagrams` command | Skill responds | ☐ |
| 10 skills available | Check agent context | All 10 skills discoverable | ☐ |

### Expected Skills (10)

| Skill | Purpose |
|-------|---------|
| azure-adr | Architecture Decision Records |
| azure-deployment-preflight | Pre-deployment validation |
| azure-diagrams | Python architecture diagrams |
| azure-workload-docs | Workload documentation |
| gh-cli | GitHub CLI operations |
| git-commit | Conventional commits |
| github-issues | Issue management |
| github-pull-requests | PR workflows |
| make-skill-template | Skill scaffolding |
| orchestration-helper | Workflow guidance |

---

## Conductor Flow

| Test | Steps | Expected | Status |
|------|-------|----------|--------|
| Conductor starts | Select "InfraOps Conductor" → Describe project | Conductor acknowledges | ☐ |
| Gate 1: Requirements | Complete requirements | Maestro asks for approval | ☐ |
| Gate 2: Architecture | Complete WAF assessment | Maestro asks for approval | ☐ |
| Gate 3: Planning | Complete implementation plan | Maestro asks for approval | ☐ |
| Gate 4: Pre-Deploy | Complete lint/what-if | Maestro asks for approval | ☐ |
| Gate 5: Post-Deploy | Deployment completes | Maestro summarizes | ☐ |

---

## Subagent Invocation

| Test | Steps | Expected | Status |
|------|-------|----------|--------|
| Conductor invokes Requirements | Start workflow | Requirements agent runs | ☐ |
| Conductor invokes Architect | After requirements | Architect agent runs | ☐ |
| Conductor invokes Bicep Plan | After architecture | Bicep Plan agent runs | ☐ |
| Conductor invokes Bicep Code | After planning | Bicep Code agent runs | ☐ |
| Setting enabled | Check devcontainer.json | `chat.customAgentInSubagent.enabled: true` | ☐ |

---

## Model Fallback

| Test | Steps | Expected | Status |
|------|-------|----------|--------|
| Agent model defined | Check agent frontmatter | `model` field present | ☐ |
| Array syntax works | Agent with model array | First available model used | ☐ |
| Fallback occurs | Disable preferred model | Falls back to next model | ☐ |

---

## Handoff Buttons

| Test | Steps | Expected | Status |
|------|-------|----------|--------|
| Handoff renders | Complete agent step | "Continue to..." button appears | ☐ |
| Handoff clickable | Click handoff button | Next agent invoked | ☐ |
| Handoff context | After handoff | Context passed correctly | ☐ |

---

## MCP Integration

| Test | Steps | Expected | Status |
|------|-------|----------|--------|
| Azure Pricing MCP starts | Check MCP status | Server running | ☐ |
| Pricing tool responds | Ask about Azure pricing | Returns SKU prices | ☐ |
| MCP in Architect | Architect uses pricing | Cost estimates generated | ☐ |

### MCP Verification

```bash
# Check MCP configuration
cat .vscode/mcp.json

# Verify MCP server
ls mcp/azure-pricing-mcp/
```

---

## Validation Commands Reference

| Command | Purpose |
|---------|---------|
| `npm run test:1109` | Full 1.109 validation suite |
| `npm run validate:vscode` | VS Code settings check |
| `npm run validate:agents` | Agent frontmatter + skills |
| `npm run lint:agent-frontmatter` | Agent YAML validation |
| `npm run lint:skills-format` | Skill file validation |
| `npm run validate:all` | Complete repository validation |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Agent not in dropdown | Check `user-invokable: true` in agent frontmatter |
| Subagent invocation fails | Verify `chat.customAgentInSubagent.enabled: true` |
| Skills not loading | Check `chat.agentSkillsLocations` in devcontainer.json |
| Handoff buttons missing | Verify YAML syntax in `handoffs` array |
| MCP tools unavailable | Restart MCP server, check `.vscode/mcp.json` |
| Model fallback broken | Check model array syntax in frontmatter |

---

## Sign-Off

| Tester | Date | VS Code Version | Result |
|--------|------|-----------------|--------|
| | | | ☐ Pass / ☐ Fail |

### Notes

_Add any observations or issues found during testing:_

---

> Last updated: 2026-02-05
