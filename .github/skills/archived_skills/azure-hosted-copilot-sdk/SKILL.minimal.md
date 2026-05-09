<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# GitHub Copilot SDK on Azure (Minimal)

**Step 1: Route**:

**Step 2A: Scaffold New (Greenfield)**:
`azd init --template azure-samples/copilot-sdk-service`

**Step 2B: Add SDK Service to Existing Repo**:
User has existing code and wants a new Copilot SDK service alongside it. Scaffold template to a temp dir, copy the API
service + infra into the user's repo, adapt `azure.yaml`. See [deploy existing ref](references/deploy-existing.md).

**Step 2C: Deploy Existing SDK App**:
User already has a working Copilot SDK app and needs Azure infra. See [deploy existing ref](references/deploy-existing.md).

Read `SKILL.md` or `SKILL.digest.md` for full content.
