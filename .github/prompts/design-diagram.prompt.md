---
description: 'Generate a Python architecture diagram for an Azure project'
agent: 'Design'
model: 'GPT-5.3-Codex'
tools:
  - read/readFile
  - edit/createFile
  - execute/runInTerminal
  - search/codebase
argument-hint: Provide the project name to generate a diagram for
---

# Generate Architecture Diagram

Create a Python architecture diagram using the `diagrams` library that
visualizes all Azure resources, network topology, and data flow for the project.

## Mission

Read the architecture assessment, extract all Azure resources and their
relationships, and generate a Python script that produces a PNG architecture
diagram following the azure-diagrams skill conventions.

## Scope & Preconditions

- `agent-output/${input:projectName}/02-architecture-assessment.md` must exist
- Read `.github/skills/azure-diagrams/SKILL.md` for diagram conventions and icon catalog
- Read `.github/skills/azure-defaults/SKILL.md` for naming conventions
- Use the `diagrams` Python library (pre-installed in dev container)

## Inputs

| Variable | Description | Default |
| --- | --- | --- |
| `${input:projectName}` | Project name matching the `agent-output/` folder | Required |

## Workflow

### Step 1: Read Architecture

Read `agent-output/{projectName}/02-architecture-assessment.md` for the
full resource list, network topology, and data flow paths.

### Step 2: Design Diagram Layout

- Group resources by Azure resource group or logical tier
- Show network connectivity (VNets, subnets, private endpoints)
- Include data flow arrows with labels
- Use the correct Azure icons from the diagrams skill icon catalog

### Step 3: Generate Python Script

Follow the azure-diagrams skill template structure:

- File header with project metadata
- Diagram context with project name as title
- Cluster groupings for resource groups or tiers
- Edge definitions for data flow

### Step 4: Execute and Verify

Run the Python script to produce the PNG output. Verify the image
renders correctly.

### Step 5: Save Artifacts

Save to `agent-output/{projectName}/03-des-diagram.py`.

## Output Expectations

```text
agent-output/{projectName}/
├── 03-des-diagram.py     # Python source
└── 03-des-diagram.png    # Rendered output
```

## Quality Assurance

- [ ] All resources from architecture assessment appear in diagram
- [ ] Icons match actual Azure service types
- [ ] Network topology accurately reflects the design
- [ ] Data flow arrows have descriptive labels
- [ ] Python script executes without errors
- [ ] PNG renders at readable resolution
