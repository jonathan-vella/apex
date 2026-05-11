<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# GitHub Copilot SDK on Azure (Digest)

Compact reference for agent startup. Read full `SKILL.md` for details.

## Step 1: Route

| User wants                           | Action                                                      |
| ------------------------------------ | ----------------------------------------------------------- |
| Build new (empty project)            | Step 2A (scaffold)                                          |
| Add new SDK service to existing repo | Step 2B (scaffold alongside)                                |
| Deploy existing SDK app to Azure     | Step 2C (add infra to existing SDK app)                     |
| Add SDK to existing app code         | [Integrate SDK](references/existing-project-integration.md) |

> _See SKILL.md for full content._

## Step 2A: Scaffold New (Greenfield)

`azd init --template azure-samples/copilot-sdk-service`

Template includes API (Express/TS) + Web UI (React/Vite) + infra (Bicep) + Dockerfiles + token scripts — do NOT recreate. See [SDK ref](references/copilot-sdk.md).

## Step 2B: Add SDK Service to Existing Repo

User has existing code and wants a new Copilot SDK service alongside it. Scaffold template to a temp dir, copy the API service + infra into the user's repo, adapt `azure.yaml` to include both existing and new services. See [deploy existing ref](references/deploy-existing.md).

## Step 2C: Deploy Existing SDK App

User already has a working Copilot SDK app and needs Azure infra. See [deploy existing ref](references/deploy-existing.md).

## Step 3: Model Configuration

Three model paths (layers on top of 2A/2B):

| Path                | Config                                             |
| ------------------- | -------------------------------------------------- |
| **GitHub default**  | No `model` param — SDK picks default               |
| **GitHub specific** | `model: "<name>"` — use `listModels()` to discover |
