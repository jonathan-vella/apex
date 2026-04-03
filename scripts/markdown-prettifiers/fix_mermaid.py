import re

with open("docs/how-it-works.md", "r", encoding="utf-8") as f:
    content = f.read()

mermaid1_old = """```mermaid
flowchart LR
    S1["Step 1\\nRequirements"]
    G1{{"Gate 1\\n🔒 Approval"}}
    S2["Step 2\\nArchitecture"]
    G2{{"Gate 2\\n🔒 Approval"}}
    S3["Step 3\\nDesign\\n(optional)"]
    S4["Step 4\\nIaC Plan"]
    G3{{"Gate 3\\n🔒 Approval"}}
    S5["Step 5\\nIaC Code"]
    G4{{"Gate 4\\n✔ Validation"}}
    S6["Step 6\\nDeploy"]
    G5{{"Gate 5\\n🔒 Approval"}}
    S7["Step 7\\nAs-Built Docs"]

    S1 --> G1 --> S2 --> G2 --> S3 --> S4 --> G3 --> S5 --> G4 --> S6 --> G5 --> S7
```"""

mermaid1_new = """```mermaid
%%{
  init: {
    'theme': 'base',
    'themeVariables': {
      'primaryColor': '#ffffff',
      'primaryTextColor': '#333333',
      'primaryBorderColor': '#e91e63',
      'lineColor': '#475569',
      'fontFamily': 'ui-sans-serif, system-ui, -apple-system, sans-serif'
    },
    'flowchart': {
      'curve': 'basis',
      'nodeSpacing': 50,
      'rankSpacing': 50
    }
  }
}%%
flowchart LR
    classDef default fill:#ffffff,stroke:#e91e63,stroke-width:2px,color:#1f2937,rx:8px,ry:8px;
    classDef gate fill:#ffffff,stroke:#3b82f6,stroke-width:2px,color:#1f2937,rx:8px,ry:8px;
    classDef endNode fill:#ffffff,stroke:#10b981,stroke-width:2px,color:#1f2937,rx:8px,ry:8px;

    S1["Step 1\\nRequirements"]
    G1{{"Gate 1\\n🔒 Approval"}}:::gate
    S2["Step 2\\nArchitecture"]
    G2{{"Gate 2\\n🔒 Approval"}}:::gate
    S3["Step 3\\nDesign\\n(optional)"]
    S4["Step 4\\nIaC Plan"]
    G3{{"Gate 3\\n🔒 Approval"}}:::gate
    S5["Step 5\\nIaC Code"]
    G4{{"Gate 4\\n✔ Validation"}}:::gate
    S6["Step 6\\nDeploy"]
    G5{{"Gate 5\\n🔒 Approval"}}:::gate
    S7["Step 7\\nAs-Built Docs"]:::endNode

    S1 --> G1 --> S2 --> G2 --> S3 --> S4 --> G3 --> S5 --> G4 --> S6 --> G5 --> S7
```"""

mermaid2_old = """```mermaid
flowchart TD
    Shared["Steps 1-3\\n(Shared)"]
    Decision{"iac_tool?"}
    Bicep["Steps 4-6\\nBicep Track\\n(05 → 06b → 07b)"]
    Terraform["Steps 4-6\\nTerraform Track\\n(05 → 06t → 07t)"]
    AsBuilt["Step 7\\nAs-Built Docs\\n(Shared)"]

    Shared --> Decision
    Decision -->|Bicep| Bicep
    Decision -->|Terraform| Terraform
    Bicep --> AsBuilt
    Terraform --> AsBuilt
```"""

mermaid2_new = """```mermaid
%%{
  init: {
    'theme': 'base',
    'themeVariables': {
      'primaryColor': '#ffffff',
      'primaryTextColor': '#333333',
      'primaryBorderColor': '#8b5cf6',
      'lineColor': '#475569',
      'fontFamily': 'ui-sans-serif, system-ui, -apple-system, sans-serif'
    },
    'flowchart': {
      'curve': 'basis',
      'nodeSpacing': 50,
      'rankSpacing': 50
    }
  }
}%%
flowchart TD
    classDef default fill:#ffffff,stroke:#8b5cf6,stroke-width:2px,color:#1f2937,rx:8px,ry:8px;
    classDef track fill:#ffffff,stroke:#ec4899,stroke-width:2px,color:#1f2937,rx:8px,ry:8px;
    classDef endNode fill:#ffffff,stroke:#10b981,stroke-width:2px,color:#1f2937,rx:8px,ry:8px;

    Shared["Steps 1-3\\n(Shared)"]
    Decision{"iac_tool?"}
    Bicep["Steps 4-6\\nBicep Track\\n(05 → 06b → 07b)"]:::track
    Terraform["Steps 4-6\\nTerraform Track\\n(05 → 06t → 07t)"]:::track
    AsBuilt["Step 7\\nAs-Built Docs\\n(Shared)"]:::endNode

    Shared --> Decision
    Decision -->|Bicep| Bicep
    Decision -->|Terraform| Terraform
    Bicep --> AsBuilt
    Terraform --> AsBuilt
```"""

mermaid3_old = """```mermaid
flowchart TD
    S1[step-1: Requirements]
    G1[gate-1: Approval]
    S2[step-2: Architecture]
    G2[gate-2: Approval]
    S3[step-3: Design]
    S4B[step-4b: Bicep Plan]
    S4T[step-4t: TF Plan]
    G3[gate-3: Approval]
    S5B[step-5b: Bicep Code]
    S5T[step-5t: TF Code]
    G4[gate-4: Validation]
    S6B[step-6b: Bicep Deploy]
    S6T[step-6t: TF Deploy]
    G5[gate-5: Approval]
    S7[step-7: As-Built]

    S1 --> G1 --> S2 --> G2
    G2 --> S3
    G2 --> S4B & S4T
    S3 --> S4B & S4T
    S4B & S4T --> G3
    G3 --> S5B & S5T
    S5B & S5T --> G4
    G4 --> S6B & S6T
    S6B & S6T --> G5
    G5 --> S7
```"""

mermaid3_new = """```mermaid
%%{
  init: {
    'theme': 'base',
    'themeVariables': {
      'primaryColor': '#ffffff',
      'primaryTextColor': '#333333',
      'primaryBorderColor': '#14b8a6',
      'lineColor': '#475569',
      'fontFamily': 'ui-sans-serif, system-ui, -apple-system, sans-serif'
    },
    'flowchart': {
      'curve': 'basis',
      'nodeSpacing': 50,
      'rankSpacing': 50
    }
  }
}%%
flowchart TD
    classDef default fill:#ffffff,stroke:#14b8a6,stroke-width:2px,color:#1f2937,rx:8px,ry:8px;
    classDef gate fill:#ffffff,stroke:#f59e0b,stroke-width:2px,color:#1f2937,rx:8px,ry:8px;
    classDef endNode fill:#ffffff,stroke:#8b5cf6,stroke-width:2px,color:#1f2937,rx:8px,ry:8px;

    S1["step-1: Requirements"]
    G1{{"gate-1: Approval"}}:::gate
    S2["step-2: Architecture"]
    G2{{"gate-2: Approval"}}:::gate
    S3["step-3: Design"]
    S4B["step-4b: Bicep Plan"]
    S4T["step-4t: TF Plan"]
    G3{{"gate-3: Approval"}}:::gate
    S5B["step-5b: Bicep Code"]
    S5T["step-5t: TF Code"]
    G4{{"gate-4: Validation"}}:::gate
    S6B["step-6b: Bicep Deploy"]
    S6T["step-6t: TF Deploy"]
    G5{{"gate-5: Approval"}}:::gate
    S7["step-7: As-Built"]:::endNode

    S1 --> G1 --> S2 --> G2
    G2 --> S3
    G2 --> S4B & S4T
    S3 --> S4B & S4T
    S4B & S4T --> G3
    G3 --> S5B & S5T
    S5B & S5T --> G4
    G4 --> S6B & S6T
    S6B & S6T --> G5
    G5 --> S7
```"""

content = content.replace(mermaid1_old, mermaid1_new)
content = content.replace(mermaid2_old, mermaid2_new)
content = content.replace(mermaid3_old, mermaid3_new)

with open("docs/how-it-works.md", "w", encoding="utf-8") as f:
    f.write(content)
