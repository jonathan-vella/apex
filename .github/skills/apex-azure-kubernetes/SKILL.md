---
name: apex-azure-kubernetes
user-invocable: true
disable-model-invocation: false
argument-hint: "workload requirements, environment type, region and constraints"
description: '**ANALYSIS SKILL** — Day-0 AKS design advice: Automatic vs Standard, networking, identity, observability, upgrades, node pools, autoscaling and Spot. WHEN: "design AKS", "AKS Automatic or Standard", "AKS networking", "AKS node pools", "rightsize AKS pods", "AKS spot nodes". DO NOT USE FOR: AKS troubleshooting (apex-azure-diagnostics), provisioning or IaC (05-IaC Planner, 06b/06t).'
license: MIT
metadata:
  author: Microsoft
  version: "1.2.2"
---

# Azure Kubernetes Service Design

Adapted from upstream `azure-kubernetes`. This skill recommends an AKS
configuration and separates **Day-0 decisions** (networking, API server access,
identity — hard to change later) from **Day-1 features** that can be enabled
after creation. It advises; it never creates or changes a cluster.

## Quick Reference

| Property        | Value                                                                                   |
| --------------- | --------------------------------------------------------------------------------------- |
| Best for        | AKS cluster planning and Day-0 decisions in Steps 2 and 4                               |
| MCP tools       | `mcp_azure-mcp_aks` (read-only discovery of existing clusters)                          |
| Implementation  | AVM `avm/res/container-service/managed-cluster` (Bicep) or `Azure/avm-res-containerservice-managedcluster/azurerm` (Terraform) through 06b/06t |
| Related skills  | `apex-azure-diagnostics` (troubleshooting), `apex-azure-quotas` (node SKU availability and quota), `apex-azure-defaults` (naming, regions, AVM) |

## Rules

1. Start from the user's requirements; ask only for missing Day-0 inputs.
2. Default to **AKS Automatic** unless a requirement needs Standard (custom node pools, networking or
   autoscaling that Node Auto-Provisioning doesn't support). Confirm the chosen features are exposed by the AVM
   module before recommending them.
3. Record each Day-0 decision with its rationale; they are expensive to change after creation.
4. Apply the APEX baseline: private API server access (API Server VNet Integration or a private cluster) for
   production, Microsoft Entra ID authentication with local accounts disabled, Workload Identity for pods, and
   the default region from `apex-azure-defaults` with availability zones.
5. Confirm node VM sizes with the `apex-azure-quotas` [SKU availability](../apex-azure-quotas/references/sku-availability.md)
   check. Price only through `cost-estimate-subagent`; don't quote discounts or savings percentages.
6. Never run `az aks` or `kubectl` commands that change state. Hand the configuration to 05-IaC Planner and
   06b/06t; existing-cluster changes need an approved change owner.

## Required Inputs

Use safe defaults when the user is unsure.

- Environment type (dev/test or production), region and zones
- Expected scale (nodes, clusters, workload size) and preferred node VM sizes
- Networking: API server access, pod IP model, ingress and egress control
- Security and identity, including the image registry
- Upgrade and observability preferences, and cost constraints

## Design Checklist

### 1. Cluster Type

- **AKS Automatic** (default): curated security, reliability and performance defaults for most production workloads.
- **AKS Standard**: full control of node pools, networking and autoscaling at the cost of more operations work.

### 2. Networking (Day-0)

- **Pod IP model**: Azure CNI Overlay (recommended; pod IPs from a private overlay range) or Azure CNI with
  VNet-routable pod IPs when pods must be addressable from the VNet or on-premises.
  See [Azure CNI Overlay](https://learn.microsoft.com/azure/aks/azure-cni-overlay).
- **Dataplane and network policy**: Azure CNI powered by Cilium.
- **Egress**: Static Egress Gateway for stable outbound IPs; UDR with Azure Firewall or an NVA for restricted egress.
- **Ingress**: App Routing add-on with Gateway API by default; Istio with Gateway API for mTLS and canary
  releases; Application Gateway for Containers for L7 load balancing with WAF.
- **DNS**: enable LocalDNS on all node pools.

### 3. Security

- Microsoft Entra ID everywhere (control plane, Workload Identity for pods, node access); no static credentials.
  See [workload identity](references/workload-identity.md).
- Azure Key Vault through the Secrets Store CSI Driver.
- Azure Policy with [Deployment Safeguards](references/safeguards.md).
- Encryption at rest and in transit; only signed, policy-approved images, preferably from Azure Container Registry.
- Isolate with namespaces, network policies and scoped logging.

### 4. Observability

- Managed Prometheus, Container Insights and Grafana for metrics and logs.
- Diagnostic settings sending control plane and audit logs to Log Analytics.

### 5. Upgrades and Patching

- Maintenance windows, and auto-upgrade for the control plane and node OS.
- LTS versions (Premium tier) for enterprise stability; AKS Fleet Manager for staged rollouts across environments.

### 6. Performance

- Ephemeral OS disks, Azure Linux node OS, and KEDA for event-driven autoscaling beyond HPA.

### 7. Node Pools and Compute

- A dedicated system node pool of at least 2 nodes, tainted `CriticalAddonsOnly`.
- Node Auto-Provisioning where supported; latest-generation VM sizes with at least 4 vCPUs for production.
- Avoid B-series (burstable) VMs; spread pods across hosts and zones with topology spread constraints.

### 8. Reliability

- Three availability zones, the Standard tier (zone-redundant control plane with an SLA), PodDisruptionBudgets
  for production workloads, and Microsoft Defender for Containers.

### 9. Cost

- Spot node pools only for interruptible workloads; stop dev/test clusters outside working hours through an
  approved operational runbook; consider reservations or savings plans for steady-state capacity.

## Deep-Dive Scenarios

Load only the reference that matches the request; if a prompt matches several, ask which one the user means.

| Scenario           | Trigger keywords                                            | Reference                                                   |
| ------------------ | ----------------------------------------------------------- | ----------------------------------------------------------- |
| Pod rightsizing    | over-provisioned pods, CPU or memory requests               | [azure-aks-rightsizing.md](references/azure-aks-rightsizing.md) |
| VPA                | vertical pod autoscaler, VPA recommendations                | [azure-aks-vpa.md](references/azure-aks-vpa.md)             |
| Cluster autoscaler | idle nodes, scale-down profile, node utilization            | [azure-aks-autoscaler.md](references/azure-aks-autoscaler.md) |
| Spot node pools    | Spot VMs, batch workloads, cheaper nodes                    | [azure-aks-spot.md](references/azure-aks-spot.md)           |

## Guardrails

- Don't request or output secrets, tokens or keys, and don't ask the user to paste subscription IDs; discover
  scope with `mcp_azure-mcp_subscription_list` or `az account show`.
- For ambiguous Day-0 requirements, ask. For Day-1 features, offer two or three safe options with trade-offs.
- Don't promise zero downtime; recommend PodDisruptionBudgets, probes, replicas and staged upgrades.
- Inspect existing clusters only with the read-only commands in the [CLI reference](references/cli-reference.md).

## Reference Index

| Reference                             | When to Load                                         |
| ------------------------------------- | ---------------------------------------------------- |
| `references/azure-aks-rightsizing.md` | Pod request and limit rightsizing                    |
| `references/azure-aks-vpa.md`         | Vertical Pod Autoscaler recommendations              |
| `references/azure-aks-autoscaler.md`  | Cluster autoscaler tuning                            |
| `references/azure-aks-spot.md`        | Spot node pool design                                |
| `references/workload-identity.md`     | Workload Identity setup for pods                     |
| `references/safeguards.md`            | Deployment Safeguards rules for workload manifests   |
| `references/cli-reference.md`         | Read-only inspection commands                        |
