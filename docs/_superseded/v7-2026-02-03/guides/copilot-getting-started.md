# Getting Started with GitHub Copilot

> **Version 5.3.0** | [Back to Guides](README.md)
>
> Your first steps with AI-assisted coding in VS Code.
>
> This guide helps IT Pros get productive with GitHub Copilot quickly, with a focus on infrastructure-as-code
> workflows.

---

## What is GitHub Copilot?

GitHub Copilot is an AI coding assistant that helps you write code faster and with less effort. It provides:

- **Code suggestions** as you type (inline completions)
- **Chat interface** for questions, explanations, and code generation
- **Agent capabilities** for complex, multi-step tasks
- **Command line** assistance via GitHub CLI

> **Proven Impact**: Research shows Copilot increases developer productivity and accelerates software development.
> See [GitHub's research](https://github.blog/2022-09-07-research-quantifying-github-copilots-impact-on-developer-productivity-and-happiness/).

---

## Copilot Strengths & Limitations

### What Copilot Does Best

| Strength                   | Example Use Case                                |
| -------------------------- | ----------------------------------------------- |
| ✅ **Writing tests**       | Generate unit tests for Bicep modules           |
| ✅ **Repetitive code**     | Create similar resource blocks, parameter files |
| ✅ **Debugging**           | "Why does this Bicep template fail validation?" |
| ✅ **Explaining code**     | "Explain what this Bicep module does"           |
| ✅ **Regular expressions** | Generate complex regex for validation           |
| ✅ **Boilerplate**         | Scaffold new modules, scripts, README files     |

### What Copilot Is Not For

| Limitation                       | Better Approach                   |
| -------------------------------- | --------------------------------- |
| ❌ **Non-coding questions**      | Use web search or docs            |
| ❌ **Replacing your expertise**  | You're in charge; Copilot assists |
| ❌ **Sensitive data generation** | Never trust AI with secrets       |

---

## Prerequisites

| Requirement            | Details                                  | Get It                                                             |
| ---------------------- | ---------------------------------------- | ------------------------------------------------------------------ |
| **GitHub Account**     | Free or paid                             | [github.com/signup](https://github.com/signup)                     |
| **Copilot License**    | Free, Pro, Pro+, Business, or Enterprise | [github.com/features/copilot](https://github.com/features/copilot) |
| **VS Code**            | Latest version recommended               | [code.visualstudio.com](https://code.visualstudio.com/)            |
| **Copilot Extensions** | Installed automatically with Copilot     | VS Code Marketplace                                                |

### Copilot Plans

| Plan                   | Best For              | Key Features                      |
| ---------------------- | --------------------- | --------------------------------- |
| **Copilot Free**       | Trying it out         | Limited features, no subscription |
| **Copilot Pro**        | Individual developers | Full features, priority access    |
| **Copilot Pro+**       | Power users           | Extra models, higher limits       |
| **Copilot Business**   | Teams/Orgs            | Admin controls, policy management |
| **Copilot Enterprise** | Large enterprises     | Custom models, extended context   |

> **Tip**: Students, teachers, and open source maintainers may qualify for free Copilot Pro. See
> [Getting free access](https://docs.github.com/en/copilot/managing-copilot/managing-copilot-as-an-individual-subscriber/getting-free-access-to-copilot-as-a-student-teacher-or-maintainer).

---

## Step 1: Install GitHub Copilot

1. Open VS Code
2. Go to **Extensions** (`Ctrl+Shift+X`)
3. Search for **"GitHub Copilot"**
4. Click **Install** on both:
   - **GitHub Copilot** (inline suggestions)
   - **GitHub Copilot Chat** (chat interface)

Alternatively, use the command line:

```bash
code --install-extension GitHub.copilot
code --install-extension GitHub.copilot-chat
```

---

## Step 2: Sign In to GitHub

1. After installation, you'll see a Copilot icon in the Activity Bar
2. Click **Sign in to GitHub** when prompted
3. Follow the browser authentication flow
4. Return to VS Code — you should see the Copilot icon active

**Verify activation**: Look for the Copilot icon in the status bar (bottom right). It should show as active.

---

## Step 3: Your First Inline Suggestion

1. Create a new file: `demo.bicep`
2. Type the following:

```bicep
// Create a storage account with secure defaults
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
```

3. Copilot will suggest the complete resource block in gray text
4. Press `Tab` to accept the suggestion

> **Tip**: Press `Ctrl+Enter` to see multiple suggestions and choose the best one.

---

## Step 4: Chat with Copilot

1. Open Copilot Chat: Press `Ctrl+Alt+I` (Windows/Linux) or `Cmd+Alt+I` (Mac)
2. Try these prompts:

**Explain code:**

```
@workspace Explain the main.bicep file in the ecommerce folder
```

**Generate code:**

```
Create a Bicep module for an Azure Key Vault with:
- RBAC authorization
- Soft delete enabled
- 90-day retention
- Private endpoint ready
```

**Fix issues:**

```
This Bicep template gives error BCP036. How do I fix it?
[paste your code]
```

---

## Step 5: Use Custom Agents (Agentic InfraOps)

This repository includes custom agents for infrastructure work:

| Agent                       | Purpose                         | When to Use               |
| --------------------------- | ------------------------------- | ------------------------- |
| `architect` | Architecture guidance (no code) | Starting a new project    |
| `bicep-plan`                | Implementation planning         | After architecture review |
| `bicep-code`           | Code generation                 | After plan approval       |
| `diagram`         | Architecture diagrams           | Documentation             |

**To invoke an agent:**

1. Press `Ctrl+Shift+A` or click **Agents** in Copilot Chat
2. Select the agent from the dropdown
3. Type your prompt

**Example workflow:**

```
Step 1: @architect
"Design a HIPAA-compliant patient portal with Azure App Service and SQL Database"

Step 2: @bicep-plan
"Create implementation plan based on the architecture"

Step 3: @bicep-code
"Generate Bicep templates from the plan"
```

See the [Workflow Guide](../reference/workflow.md) for the complete seven-step process.

---

## Keyboard Shortcuts

| Action              | Windows/Linux | Mac          |
| ------------------- | ------------- | ------------ |
| Accept suggestion   | `Tab`         | `Tab`        |
| Dismiss suggestion  | `Esc`         | `Esc`        |
| See alternatives    | `Ctrl+Enter`  | `Ctrl+Enter` |
| Next suggestion     | `Alt+]`       | `Option+]`   |
| Previous suggestion | `Alt+[`       | `Option+[`   |
| Open Copilot Chat   | `Ctrl+Alt+I`  | `Cmd+Alt+I`  |
| Inline chat         | `Ctrl+I`      | `Cmd+I`      |

---

## Next Steps

- **Best practices** → [Copilot Best Practices](copilot-best-practices.md)
- **Model selection** → [Choosing the Right Model](copilot-model-selection.md)
- **First scenario** → [S01 Bicep Baseline](../../scenarios/S01-bicep-baseline/)
- **Troubleshooting** → [Troubleshooting Guide](troubleshooting.md)

---

## Resources

- [GitHub Copilot Documentation](https://docs.github.com/en/copilot)
- [VS Code Copilot Tips](https://code.visualstudio.com/docs/copilot/prompt-crafting)
- [Copilot Best Practices (Official)](https://docs.github.com/en/copilot/get-started/best-practices)
- [GitHub Copilot Introduction (Video)](https://www.youtube.com/watch?v=SJqGYwRq0uc)
