# S07: Diagrams-as-Code with GitHub Copilot

> **Version 5.3.0** | [Back to Scenarios](../README.md)
>
> **🎯 Skill Available**: This scenario uses the `azure-diagrams` skill for integration with
> the 7-step workflow. See `.github/skills/azure-diagrams/SKILL.md`.

---

## Meet David Kim

> **Role**: Solutions Architect at TechVentures Ltd  
> **Experience**: 8 years in cloud architecture, expert in Azure and AWS  
> **Today's Challenge**: Design review meeting in 2 hours - needs to document a new microservices architecture  
> **The Twist**: He's heard about "diagrams-as-code" but has never used it

_"I've been dragging boxes in Visio for years. There has to be a better way - something I can version control
with my infrastructure code. But I don't have time to read documentation right now..."_

**What Marcus will discover**: How to use Copilot as a learning partner to understand diagrams-as-code concepts,
not just generate scripts. In 20 minutes, he'll go from "never used it" to creating professional architecture
diagrams he fully understands.

---

## Overview

This scenario demonstrates how GitHub Copilot serves as a **learning partner** for understanding diagrams-as-code
concepts, not just generating Python scripts. The goal is to build transferable knowledge so architects can
create and maintain architecture diagrams independently.

**Duration**: 20 minutes  
**Target Audience**: Cloud Architects, Solutions Architects, DevOps Engineers  
**Difficulty**: Beginner  
**Prerequisites**: VS Code with GitHub Copilot Chat (Python optional for running output)

## Learning Objectives

By the end of this demo, participants will understand:

1. **What diagrams-as-code is** and when it's the right approach
2. **How to think architecturally** about visual representation
3. **The `diagrams` library structure** (Diagram → Cluster → Components → Edges)
4. **Icon sources and naming conventions** for Azure, AWS, GCP
5. **Connection operators** (`>>`, `<<`, `Edge()`) and styling
6. **Best practices** for team adoption and CI/CD integration
7. **Trade-offs** vs. traditional tools like Visio

## Related Resources

| Resource                                                             | Description                    |
| -------------------------------------------------------------------- | ------------------------------ |
| [Azure Diagrams Skill](../../.github/skills/azure-diagrams/SKILL.md) | Skill definition               |
| [Workflow Guide](../../docs/workflow.md)                             | Seven-step agentic workflow    |
| [Presenter Toolkit](../../docs/presenter/)                           | Demo delivery guides           |
| [S02: Agentic Workflow](../S02-agentic-workflow/)                    | Integration with main workflow |

## The Challenge: Traditional Diagramming Pain Points

| Problem                | Impact                                             | Business Cost                   |
| ---------------------- | -------------------------------------------------- | ------------------------------- |
| **Drift**              | Diagrams become outdated as infrastructure changes | Wrong decisions from stale docs |
| **Inconsistency**      | Different architects use different styles/icons    | Confusion in reviews            |
| **No Version Control** | Binary files (Visio, PPT) can't be diffed          | No audit trail of changes       |
| **Manual Effort**      | Aligning boxes and arrows takes significant time   | 30-45 min per diagram           |
| **No Automation**      | Can't regenerate when architecture changes         | Always out of date              |

## The Solution: Conversation-Based Learning

Instead of asking Copilot to "generate a diagram script," we use Copilot as a **teaching partner** to:

1. **Understand the concept** before writing code
2. **Think architecturally** about visual representation
3. **Learn the library structure** while building something real
4. **Build transferable skills** for future diagrams

## Scenario

**Character**: David Kim, Solutions Architect at TechVentures Ltd  
**Situation**: Design review meeting in 2 hours. Needs to document a new microservices architecture.
Has never used diagrams-as-code before.

**Architecture to Document**:

- Azure Front Door (global entry point)
- AKS Cluster with 3 microservices (Product, Order, User)
- Azure SQL Database + Redis Cache (data tier)
- Key Vault + Application Insights (platform services)

**Traditional Approach**: 45 minutes in Visio dragging boxes  
**Conversation Approach**: 20 minutes learning + creating with understanding

## Demo Components

```
S07-diagrams-as-code/
├── README.md                              # This file
├── DEMO-SCRIPT.md                         # 20-minute presenter guide
├── examples/
│   └── copilot-diagrams-conversation.md   # ⭐ Full conversation transcript
├── prompts/
│   └── effective-prompts.md               # Discovery questions guide
├── solution/
│   ├── README.md                          # Legacy automation explanation
│   ├── architecture.py                    # Reference implementation
│   └── requirements.txt                   # Python dependencies
└── validation/
    └── validate.ps1                       # Validation script
```

## Quick Start

### Option 1: Conversation-First (Recommended)

1. Open VS Code with GitHub Copilot Chat
2. Review `examples/copilot-diagrams-conversation.md` for the approach
3. Start your own conversation:

   ```
   I need to document our Azure architecture for a design review. I've heard about
   diagrams-as-code but never used it. Can you help me understand if it's the right
   approach and walk me through creating a diagram?
   ```

4. Follow the 5-phase conversation flow (see below)

### Option 2: Watch the Demo

Review `examples/copilot-diagrams-conversation.md` to see a complete 20-minute conversation showing:

- Concept explanation (when to use diagrams-as-code)
- Architecture discovery (how to think about visual representation)
- Code generation with understanding
- Customization and iteration
- Best practices for teams

### Option 3: Run the Reference Solution

```bash
# Install dependencies
pip install diagrams
sudo apt-get install graphviz  # Linux
# brew install graphviz        # Mac

# Generate diagram
cd solution/
python architecture.py

# View output
open ecommerce_architecture.png  # Mac
xdg-open ecommerce_architecture.png  # Linux
```

## Key Copilot Features Demonstrated

| Feature                    | How It's Used                                        |
| -------------------------- | ---------------------------------------------------- |
| **Conceptual Teaching**    | Explains what diagrams-as-code is and when to use it |
| **Trade-off Analysis**     | Honest comparison with Visio/Draw.io                 |
| **Architectural Thinking** | Helps structure components into logical tiers        |
| **Step-by-Step Building**  | Explains each code section as it's written           |
| **Customization Guidance** | Shows styling options (edges, colors, labels)        |
| **Best Practices**         | Team adoption, version control, CI/CD integration    |

## 5-Phase Conversation Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│  Phase 1: Understanding (3 min)                                     │
│  "What is diagrams-as-code? Should I use it for my situation?"      │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Phase 2: Architecture Discovery (5 min)                            │
│  "Here are my components. How should I organize them visually?"     │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Phase 3: Code Generation (5 min)                                   │
│  "Let's write the code - explain each part as we go."               │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Phase 4: Iteration & Customization (5 min)                         │
│  "How can I highlight the critical path? Add labels?"               │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Phase 5: Best Practices (2 min)                                    │
│  "How should I manage this with my team? CI/CD integration?"        │
└─────────────────────────────────────────────────────────────────────┘
```

## Success Metrics

### Time Efficiency

| Metric              | Traditional | With Copilot | Improvement |
| ------------------- | ----------- | ------------ | ----------- |
| First diagram       | 45 min      | 20 min       | 56% faster  |
| Subsequent diagrams | 30-45 min   | 5-10 min     | 78% faster  |
| Updates/changes     | 15-20 min   | 2-3 min      | 85% faster  |

### Knowledge Transfer

| Metric                   | Script Generation | Conversation Approach |
| ------------------------ | ----------------- | --------------------- |
| Understanding gained     | Minimal           | Complete              |
| Can modify independently | Limited           | Yes                   |
| Can teach others         | No                | Yes                   |
| Next diagram time        | Same (ask again)  | 78% faster            |

### Quality Improvements

- ✅ **Version Control**: Full Git history of diagram changes
- ✅ **Consistency**: Same icons and styling across all diagrams
- ✅ **Automation**: CI/CD can regenerate on architecture changes
- ✅ **Review Process**: Code diffs show exactly what changed

## Business Value

### Time Savings Calculation

**Single Architect (First Year)**:

- Diagrams per month: 4
- Traditional time: 4 × 40 min = 160 min/month
- After learning: 4 × 8 min = 32 min/month
- Monthly savings: 128 minutes = 2.1 hours
- **Annual time saved: 25 hours**

**Team of 5 Architects**:

- Annual time saved: 25 × 5 = **125 hours/year (3+ work weeks)**
- Plus: Consistent quality, version control, automation

### Efficiency Metrics

| Metric                         | Value            |
| ------------------------------ | ---------------- |
| Time reduction per diagram     | 80%              |
| Annual hours saved (team of 5) | 125 hours        |
| Learning curve                 | 20 min           |
| Consistency improvement        | 100% (templated) |

**Additional Benefits**: Version-controlled diagrams, automated generation, team standardization

## Use Cases

### 1. Design Reviews

**Need**: Professional architecture diagram in 2 hours  
**Approach**: Conversation to understand components → Generate diagram → Iterate styling  
**Outcome**: Clean, version-controlled diagram with full understanding

### 2. Documentation Updates

**Need**: Keep architecture docs current with infrastructure changes  
**Approach**: Modify Python code → Regenerate PNG → Commit both  
**Outcome**: Docs stay in sync with actual architecture

### 3. Team Standardization

**Need**: Consistent diagram style across 5 architects  
**Approach**: Shared styling module → CI/CD generation → PR reviews  
**Outcome**: Professional, consistent output from everyone

### 4. Client Deliverables

**Need**: High-quality diagrams for customer presentations  
**Approach**: Generate base diagram → Post-process for annotations  
**Outcome**: Professional deliverables in fraction of time

### 5. Architecture Decision Records

**Need**: Visual representation of architecture evolution  
**Approach**: Diagram per ADR → Git history shows changes  
**Outcome**: Visual audit trail of architecture decisions

## Troubleshooting

### Copilot Doesn't Understand Diagrams Library

**Symptom**: Generic Python code instead of `diagrams` library specifics

**Solution**: Be explicit about the library:

```
I want to use the Python 'diagrams' library by mingrammer (https://diagrams.mingrammer.com/).
Can you show me how to create an Azure architecture diagram with this specific library?
```

### Missing Azure Icons

**Symptom**: "No module named 'diagrams.azure.network'"

**Solution**: Check icon availability:

```
What Azure icons are available in the diagrams library? I need Front Door, AKS, SQL Database.
```

### Graphviz Not Found

**Symptom**: "ExecutableNotFound: failed to execute 'dot'"

**Solution**: Install Graphviz:

```bash
# Ubuntu/Debian
sudo apt-get install graphviz

# Mac
brew install graphviz

# Windows
choco install graphviz
```

### Diagram Layout Issues

**Symptom**: Components not arranged as expected

**Solution**: Ask about layout options:

```
The components are arranged oddly. How can I control the layout direction and grouping
in the diagrams library?
```

---

📖 **For general issues** (Dev Container, Copilot problems, tool installation), see the [Troubleshooting Guide](../../docs/guides/troubleshooting.md).

## Next Steps

### For Presenters

1. Review `DEMO-SCRIPT.md` for the 20-minute walkthrough
2. Practice the conversation flow with Copilot
3. Prepare your own architecture example for live demo
4. Have backup: `examples/copilot-diagrams-conversation.md`

### For Learners

1. Start with `examples/copilot-diagrams-conversation.md`
2. Try your own architecture in a conversation
3. Run `solution/architecture.py` to see output
4. Experiment with styling and customization

### For Teams

1. Establish shared styling conventions
2. Set up CI/CD diagram generation
3. Create template repository structure
4. Document in team wiki

## Key Takeaways

### For Architects

- **Diagrams-as-code** solves drift, inconsistency, and version control problems
- **Understanding beats copying** - learn the concepts, not just the syntax
- **5-10 minutes** for future diagrams (after 20-minute learning investment)
- **Version control** brings architectural changes into code review process

### For Leaders

- **25 hours/year saved** per architect in diagram creation time
- **Consistency** improves with automated styling
- **Knowledge transfers** - architects can teach each other
- **Audit trail** - Git history shows architecture evolution

### For Partners

- **Quick win demo** - visible results in 20 minutes
- **Universal applicability** - every organization has diagrams
- **Low barrier** - no infrastructure required
- **High efficiency** - 80% time reduction per diagram

---

## Related Resources

- [Python Diagrams Library](https://diagrams.mingrammer.com/)
- [Azure Icons Reference](https://diagrams.mingrammer.com/docs/nodes/azure)
- [S03: Documentation Generation](../S03-documentation-generation/)
- [Workflow Guide](../../docs/reference/workflow.md)

---

_This scenario demonstrates using GitHub Copilot as a learning partner for diagrams-as-code.
The focus is on building understanding, not just generating scripts._
