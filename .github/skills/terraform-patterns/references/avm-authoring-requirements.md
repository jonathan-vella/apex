<!-- ref:avm-authoring-requirements-v1 -->

# Azure Verified Modules (AVM) — Authoring Requirements

Mandatory requirements for AVM-certified Azure Terraform modules.
For runtime issues (set-type diffs, provider pins, 4.x changes) see `avm-pitfalls.md`.

**References:**

- [Azure Verified Modules](https://azure.github.io/Azure-Verified-Modules/)
- [AVM Terraform Requirements](https://azure.github.io/Azure-Verified-Modules/specs/terraform/)

---

## Module Cross-Referencing (TFFR1)

- Modules **MUST** be referenced using Terraform registry with pinned version:
  `source = "Azure/xxx/azurerm"` with `version = "1.2.3"`
- **MUST NOT** use git references or non-AVM modules

## Azure Provider Requirements (TFFR3)

| Provider | Constraint |
| -------- | ---------- |
| azurerm  | `~> 4.0`   |
| azapi    | `~> 2.0`   |

Authors **MAY** select either or both. **MUST** use `required_providers` block.

## Code Style Standards

### Lower snake_casing (TFNFR4)

**MUST** use `lower_snake_casing` for: locals, variables, outputs, resources, modules.

### Resource & Data Source Ordering (TFNFR6)

Resources that are depended on **SHOULD** come first.

### Count & for_each Usage (TFNFR7)

- `count` for conditional creation
- `for_each` **MUST** use `map(xxx)` or `set(xxx)` with static literal keys

```hcl
resource "azurerm_subnet" "pair" {
  for_each             = var.subnet_map  # map(string)
  name                 = "${each.value}-pair"
  resource_group_name  = azurerm_resource_group.this.name
  virtual_network_name = azurerm_virtual_network.this.name
  address_prefixes     = ["10.0.1.0/24"]
}
```

### Block Internal Ordering (TFNFR8)

1. **Top meta-arguments**: `provider`, `count`, `for_each`
2. **Arguments/blocks** (alphabetical): required → optional → nested blocks
3. **Bottom meta-arguments**: `depends_on`, `lifecycle` (`create_before_destroy`, `ignore_changes`, `prevent_destroy`)

### Module Block Ordering (TFNFR9)

1. `source`, `version`, `count`, `for_each`
2. Arguments (alphabetical)
3. `depends_on`, `providers`

### Lifecycle ignore_changes (TFNFR10)

**MUST NOT** quote: `ignore_changes = [tags]` not `["tags"]`.

### Dynamic Blocks (TFNFR12)

```hcl
dynamic "identity" {
  for_each = var.identity_type != null ? [var.identity_type] : []
  content {
    type = identity.value
  }
}
```

### Default Values (TFNFR13)

Prefer `coalesce()` over ternary for defaults.

### Provider Declarations in Modules (TFNFR27)

**MUST NOT** declare `provider` blocks in modules (except `configuration_aliases`).

## Variable Requirements

| Rule                                                 | ID      | Severity |
| ---------------------------------------------------- | ------- | -------- |
| No `enabled`/`module_depends_on` variables           | TFNFR14 | MUST     |
| Order: required (alpha) then optional (alpha)        | TFNFR15 | SHOULD   |
| Positive feature switches (`xxx_enabled`)            | TFNFR16 | SHOULD   |
| All variables have `description`                     | TFNFR17 | SHOULD   |
| All variables have precise `type` (avoid `any`)      | TFNFR18 | MUST     |
| Sensitive objects: whole variable `sensitive = true` | TFNFR19 | SHOULD   |
| Collections: `nullable = false`                      | TFNFR20 | SHOULD   |
| Avoid `nullable = true` unless semantic need         | TFNFR21 | MUST     |
| Never write `sensitive = false`                      | TFNFR22 | MUST     |
| No default values for sensitive inputs               | TFNFR23 | MUST     |
| Deprecated vars → `deprecated_variables.tf`          | TFNFR24 | MUST     |

## Output Requirements (TFFR2)

- **SHOULD NOT** output entire resource objects (anti-corruption layer pattern)
- Output _computed_ attributes as discrete outputs
- Sensitive outputs: `sensitive = true`
- `for_each` resources: output as map structure
- Deprecated outputs → `deprecated_outputs.tf`

```hcl
output "key_vault_id" {
  description = "Resource ID of the Key Vault"
  value       = azurerm_key_vault.this.id
}

output "subnet_ids" {
  description = "Map of subnet names to IDs"
  value = {
    for key, value in azurerm_subnet.this : key => value.id
  }
}
```

## Local Values (TFNFR31-33)

- `locals.tf` **SHOULD** only contain `locals` blocks
- Expressions **MUST** be arranged alphabetically
- Use precise types

## Terraform Configuration (TFNFR25-26)

- `terraform.tf` **MUST** contain exactly one `terraform` block
- First line: `required_version` with `~> #.#` format
- `required_providers`: `source` + `version` for each, sorted alphabetically

```hcl
terraform {
  required_version = "~> 1.9"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
  }
}
```

## Testing Requirements (TFNFR5)

Required tools: `terraform validate/fmt/test`, terrafmt, Checkov, tflint (azurerm ruleset).
Test provider: set `prevent_deletion_if_contains_resources = false` (TFNFR36).

## Breaking Changes & Feature Management

### Feature Toggles (TFNFR34)

New resources in minor/patch versions **MUST** have a toggle:

```hcl
variable "create_route_table" {
  type     = bool
  default  = false
  nullable = false
}

resource "azurerm_route_table" "this" {
  count = var.create_route_table ? 1 : 0
  # ...
}
```

### Potential Breaking Changes (TFNFR35)

**Resource blocks**: adding without conditional, arguments with non-default values,
nested blocks without `dynamic`, renaming without `moved`, changing `count`↔`for_each`.

**Variable/Output blocks**: deleting/renaming, changing type/default/nullable/sensitive.

## Documentation (TFNFR2)

**MUST** use [terraform-docs](https://github.com/terraform-docs/terraform-docs)
with `.terraform-docs.yml` in module root.

## Compliance Checklist

### Module Structure

- [ ] Registry references with pinned versions (no git refs)
- [ ] Azure providers meet version constraints
- [ ] `.terraform-docs.yml` present

### Code Style

- [ ] All names use lower snake_casing
- [ ] `for_each` uses `map()` or `set()` with static keys
- [ ] Block ordering follows TFNFR8/TFNFR9
- [ ] Dynamic blocks for conditional nested objects
- [ ] `coalesce()`/`try()` for defaults

### Variables & Outputs

- [ ] Precise types, descriptions, no `any`
- [ ] Collections `nullable = false`
- [ ] No `sensitive = false`, no defaults for sensitive inputs
- [ ] Anti-corruption layer outputs (discrete attributes)
- [ ] Deprecated items in `deprecated_*.tf`

### Quality

- [ ] Feature toggles for new resources
- [ ] Breaking changes documented
- [ ] Required test tools configured

**Total: 37 requirements (21 MUST, 14 SHOULD, 2 MAY)**
