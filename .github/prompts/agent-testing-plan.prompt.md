# Comprehensive Agent Testing & Validation Plan

> **Purpose**: Create an automated testing and validation plan for all agents in the Agentic InfraOps workflow
> **Target Agent**: `plan` (custom agent)
> **Expected Output**: `agent-output/agent-testing/01-requirements.md`

---

## Context

We have 9 custom agents in the `.github/agents/` folder that work together to deliver Azure infrastructure
from requirements through deployment and operations. These agents need comprehensive testing and validation to
ensure:

1. **Functional correctness** - Each agent produces expected outputs
2. **Integration validation** - Agents work together in the 7-step workflow
3. **Quality assurance** - Outputs meet documentation and code standards
4. **Regression prevention** - Changes don't break existing functionality
5. **Automation readiness** - Tests can run in CI/CD pipelines

## Agents to Test

### Core Workflow Agents (7-Step Process)

1. **plan** (Step 1)
   - Purpose: Requirements and NFR gathering
   - Input: User requirements prompt
   - Output: `01-requirements.md`
   - Critical validation: All NFRs captured (SLA, RTO, RPO, cost constraints)

2. **architect** (Step 2)
   - Purpose: WAF assessment and architecture design
   - Input: `01-requirements.md`
   - Output: `02-architecture-assessment.md`
   - Critical validation: WAF pillar scores, service recommendations, cost estimates
   - MCP Integration: Azure Pricing MCP for real-time cost data

3. **diagram** (Steps 3 & 7)
   - Purpose: Python-based architecture visualization
   - Input: Architecture assessment or deployment summary
   - Output: `03-des-diagram.py/.png` or `07-ab-diagram.py/.png`
   - Critical validation: Valid Python code, Diagrams library usage, successful PNG generation

4. **adr** (Steps 3 & 7)
   - Purpose: Architecture Decision Records
   - Input: Architecture decisions or deployment results
   - Output: `03-des-adr-*.md` or `07-ab-adr-*.md`
   - Critical validation: ADR template compliance, decision rationale, alternatives considered

5. **bicep-plan** (Step 4)
   - Purpose: Policy discovery and implementation planning
   - Input: `02-architecture-assessment.md`
   - Output: `04-implementation-plan.md`, `04-governance-constraints.md/.json`
   - Critical validation: Policy compliance, resource dependencies, module structure
   - Azure Integration: Queries Azure Resource Graph for policy assignments

6. **bicep-code** (Step 5)
   - Purpose: Generate production-ready Bicep IaC
   - Input: `04-implementation-plan.md`
   - Output: `infra/bicep/{project}/` (main.bicep, modules/, deploy.ps1)
   - Critical validation: Bicep lint/build passes, AVM patterns, security defaults, unique naming

7. **deploy** (Step 6)
   - Purpose: Azure deployment orchestration
   - Input: `infra/bicep/{project}/`
   - Output: `06-deployment-summary.md`
   - Critical validation: What-if analysis, successful deployment, resource IDs captured

8. **docs** (Step 7)
   - Purpose: Generate customer-deliverable documentation
   - Input: All previous outputs
   - Output: 6+ documentation files (design doc, runbook, cost estimate, inventory, DR plan, compliance matrix)
   - Critical validation: Completeness, markdown quality, template compliance

### Supporting/Diagnostic Agents

9. **diagnose** (Post-deployment)
   - Purpose: Resource health diagnostics and troubleshooting
   - Input: Azure Resource IDs
   - Output: `08-resource-health-report.md`
   - Critical validation: AppLens integration, actionable recommendations

## Testing Requirements

### 1. **Functional Testing** (Each Agent in Isolation)

Test each agent independently with known inputs to validate:

- Output file creation in correct location with correct naming
- Content quality and completeness
- Template/pattern compliance
- Error handling for invalid inputs
- Edge cases (minimal requirements, complex scenarios)

**Success Criteria:**

- All expected output files created
- Content passes markdown/bicep linting
- No broken references or missing sections
- Handles edge cases gracefully

### 2. **Integration Testing** (End-to-End Workflow)

Test the complete 7-step workflow with hand-offs between agents:

- Step 1 → Step 2 → ... → Step 7
- Verify each agent can consume previous agent's output
- Test multiple project types (web app, database, microservices)
- Validate artifact naming conventions (`-des` vs `-ab` suffixes)

**Success Criteria:**

- Complete workflow from requirements to deployment documentation
- No manual intervention needed between steps
- All cross-references resolve correctly
- Consistent project naming and metadata

### 3. **Code Quality Testing** (Generated Artifacts)

Validate generated code meets standards:

- **Bicep code**: `bicep build` and `bicep lint` pass
- **Python diagrams**: Executes without errors, generates valid PNG
- **PowerShell scripts**: PSScriptAnalyzer passes, follows best practices
- **Markdown**: markdownlint-cli2 passes, links resolve

**Success Criteria:**

- Zero linting errors
- All code is executable/deployable
- Follows project conventions (.github/instructions/)

### 4. **Azure Integration Testing** (Real Environment)

Test Azure-dependent agents with live subscriptions:

- **bicep-plan**: Queries Azure Resource Graph for policies
- **architect**: Uses Azure Pricing MCP for cost data
- **deploy**: Performs what-if and deploys to test resource groups
- **diagnose**: Queries AppLens for resource health

**Success Criteria:**

- Agents successfully authenticate and query Azure
- Rate limits and permissions handled gracefully
- Test resource groups cleaned up after testing
- No production impact

### 5. **Regression Testing** (Prevent Breakage)

Create baseline test cases for each scenario:

- **S02-agentic-workflow**: Static web app baseline
- **S04-service-validation**: API + database baseline
- Run tests after agent changes to detect regressions

**Success Criteria:**

- Baseline outputs remain consistent
- Breaking changes are identified immediately
- Version-to-version diff reports generated

### 6. **Performance Testing** (Response Times)

Measure and track agent performance:

- Time to generate requirements (plan agent)
- Time to generate architecture assessment (architect agent)
- Time to generate Bicep code (bicep-code agent)
- Total workflow execution time

**Success Criteria:**

- Agents complete within reasonable timeframes
- Performance doesn't degrade over time
- Bottlenecks identified and documented

### 7. **Documentation Validation** (User Experience)

Ensure generated documentation is usable:

- Clear structure and navigation
- Complete information (no "TBD" or missing sections)
- Consistent terminology and formatting
- References resolve (file links, URLs)
- Suitable for customer delivery

**Success Criteria:**

- Documentation index is complete
- All cross-references work
- Professional quality for stakeholders

## Automation Requirements

Design the test plan for maximum automation:

1. **Test Execution Framework**
   - PowerShell scripts for test orchestration
   - JSON test case definitions for repeatability
   - Parallel execution where possible

2. **CI/CD Integration**
   - GitHub Actions workflow for agent validation
   - Triggered on: agent file changes, workflow changes, manual dispatch
   - Test against dev/staging Azure subscriptions

3. **Test Data Management**
   - Sample requirements for different project types
   - Known-good baseline outputs
   - Test Azure subscriptions with policies pre-configured

4. **Reporting & Observability**
   - Test execution logs with timestamps
   - Pass/fail status for each test category
   - Diff reports for regression detection
   - Performance metrics over time

5. **Failure Handling**
   - Clear error messages with remediation steps
   - Automatic cleanup of test artifacts
   - Rollback capabilities for failed deployments

## Test Project Scenarios

Create test cases for diverse infrastructure types:

1. **Simple Static Web App**
   - Azure Static Web Apps
   - Minimal configuration
   - Fast execution for smoke tests

2. **API with Database**
   - App Service + Azure SQL Database
   - Managed Identity
   - Security and networking

3. **Microservices Architecture**
   - Container Apps
   - Service Bus
   - Key Vault
   - Multiple modules and dependencies

4. **Data Platform**
   - Synapse Analytics / Data Factory
   - Storage Accounts
   - Complex networking

5. **Mission-Critical E-commerce**
   - High availability (zone redundancy)
   - DR requirements (RTO/RPO)
   - Cost optimization constraints
   - Compliance requirements (PCI-DSS)

## Success Metrics

Define measurable success criteria:

1. **Coverage**: All 6 agents and 9 skills have functional tests
2. **Pass Rate**: ≥95% of tests pass consistently
3. **Execution Time**: Full test suite completes in <30 minutes
4. **Automation**: ≥90% of tests run without manual intervention
5. **CI/CD Integration**: Tests run on every PR and merge
6. **Documentation**: Test plan and results are documented
7. **Regression Detection**: New issues caught within 1 day of introduction

## Constraints & Considerations

- **Azure Costs**: Use cheapest SKUs for test resources, auto-cleanup after tests
- **Rate Limits**: Handle Azure Resource Graph and MCP throttling
- **Permissions**: Test with least-privilege Azure credentials
- **Parallel Execution**: Some agents can run in parallel, others depend on previous outputs
- **Dev Container**: Tests should run in the dev container environment
- **Cross-Platform**: Tests work on Linux (CI) and Windows (local dev)

## Deliverables

Create the following testing assets:

1. **Test Plan Document** (`agent-output/agent-testing/01-requirements.md`)
   - Detailed test cases for each agent
   - Test data specifications
   - Expected outputs and validation criteria

2. **Test Scripts** (`scripts/test-agents/`)
   - PowerShell orchestration scripts
   - Test case definitions (JSON)
   - Validation functions

3. **CI/CD Workflow** (`.github/workflows/test-agents.yml`)
   - GitHub Actions workflow
   - Azure authentication setup
   - Test execution and reporting

4. **Baseline Outputs** (`scenarios/*/expected-outputs/`)
   - Known-good outputs for regression testing
   - Version controlled for diff comparison

5. **Test Documentation** (`docs/guides/agent-testing.md`)
   - How to run tests locally
   - How to add new test cases
   - Troubleshooting guide

## Instructions for the Plan Agent

Please create a comprehensive test plan (`01-requirements.md`) with the following structure:

1. **Executive Summary**: Testing goals and scope
2. **Agent Inventory**: Detailed breakdown of each agent with test priorities
3. **Test Categories**: Functional, integration, quality, Azure, regression, performance
4. **Test Cases**: Specific test scenarios with inputs, expected outputs, validation criteria
5. **Automation Strategy**: Framework, CI/CD integration, reporting
6. **Test Data**: Sample projects, baseline outputs, test Azure subscriptions
7. **Implementation Roadmap**: Phased approach to build the test suite
8. **Success Metrics**: KPIs and acceptance criteria
9. **Risk Mitigation**: Handling costs, rate limits, failures
10. **Appendices**: Test case templates, result templates, sign-off criteria

**Output Location**: `agent-output/agent-testing/01-requirements.md`

**Format**: Follow the standard requirements template from `.github/instructions/markdown.instructions.md`

**Key Focus Areas**:

- Maximum automation (minimize manual steps)
- Fast feedback loops (catch issues early)
- Cost-effective (minimize Azure spend on testing)
- Maintainable (easy to add new tests)
- Actionable results (clear pass/fail, remediation steps)

---

## Ready to Begin

This prompt provides all context needed for the plan agent to create a comprehensive, automated test plan
for all agents in the Agentic InfraOps workflow.

**Next Step**:

1. Open Copilot Chat (`Ctrl+Alt+I`)
2. Select the `plan` agent
3. Submit this prompt (or reference this file)
4. Review and approve the generated `01-requirements.md`
5. Proceed to architect agent for test framework design
