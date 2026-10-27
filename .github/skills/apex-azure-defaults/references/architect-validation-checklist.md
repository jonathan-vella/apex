<!-- ref:architect-validation-checklist-v1 -->

# Architect Validation Checklist

Load once before presenting the Step 2 Approval Gate. Every item must hold.
Use the dependency-path check below before committed pricing and after an accepted design repair,
not only at the final approval gate.

- [ ] All 5 WAF pillars scored with rationale and confidence level
- [ ] Service Maturity Assessment table included
- [ ] Cost estimate uses worker-verified MCP data or the documented direct-API evidence fallback, with truthful sources
- [ ] **Every dollar figure** in 02 and 03 artifacts traces back to `cost-estimate-subagent` response — no hardcoded prices
- [ ] Line-item totals sum correctly to reported monthly total
- [ ] H2 headings match apex-azure-artifacts templates exactly
- [ ] Region selection justified (default: swedencentral)
- [ ] AVM modules recommended where available
- [ ] No deprecated services recommended (checked against apex-azure-defaults Deprecated Services table)
- [ ] Service retirement timelines verified for any multi-year RI commitments
- [ ] Storage redundancy tier compatible with data residency requirements (no GRS with single-region GDPR)
- [ ] Global/non-regional services (Front Door, Entra, Traffic Manager) flagged for EU Data Boundary compliance
- [ ] SKU zone-redundancy capabilities verified for all services claiming AZ support
- [ ] A recorded owner decision that conflicts with the budget was asked about, not substituted
- [ ] No `*.tmp.md` or `FAILED` cost estimate remains in the project folder; superseded files are in `_meta/`

## Dependency-path closure before pricing or re-review

Use the existing capability/dependency matrix. For each affected capability, trace the complete
consumer-to-service path rather than checking only the component named in a finding:

| Dimension | Required design evidence |
| --- | --- |
| Consumer and owner | Intended operation, caller, service and responsible owner |
| Identity | Authentication, authorization, credentials and lifecycle/rotation ownership |
| Network and DNS | Each hop, DNS resolution, routes, subnet controls and private endpoint reachability |
| Outbound dependencies | Identity endpoints, agent bootstrap, package updates and required external services |
| Observability | How the operation, denial and failure are logged and detected |
| Recovery | How the capability and its data are recovered within the approved target |
| Cost and handoff | Affected billable resources, current estimate revision and downstream implementation owner |

Classify each row as Designed, Unresolved or Deferred with evidence and owner.
Keep runtime status Unverified until actual scoped tests establish it. Source guidance and a
completed checklist are not connectivity, recovery or authorization proof.

For example, a synthetic break-glass path is operator → Bastion → jump VM → private data service.
Hardening the VM alone leaves the capability unresolved if it has no outbound path for required
bootstrap, identity or updates. Adding NAT alone does not resolve a subnet policy that blocks SQL
on TCP 1433 to its private endpoint. Adding that allow rule alone does not establish restricted
egress unless the design also identifies rule priorities, the explicit deny-all rule and DNS.
Recheck identity/rotation, audit and recovery dependencies after those network changes.

Apply compatible authorized repairs as a coherent batch, check the whole affected path, then freeze
the revised inputs. Recalculate only affected cost lines with current equivalent meter evidence
and re-review only affected artifacts. Preserve unchanged current evidence and prior decisions.
Changed topology, upstream requirements or scope outside the accepted repair returns to its owner;
neither acceptance nor this checklist authorizes it or guarantees reviewer approval.

For single-environment `dev`/prototype workloads without existing private network transit, keep private
delivery proportional to the prototype scope: do not require persistent `Azure Bastion Standard` +
`NAT Gateway` unless the user explicitly selects persistent bastion infrastructure over temporary/ephemeral
deployment-time access. Likewise, price only project-deployed billable Azure resources in `02-cost-estimate.request.json`
(never subscription/management-group Defender plans, external policy-owned Log Analytics workspaces, email
notification sub-meters, or free control-plane constructs).

## WAF scoring table format

Illustrative structure only; compute every score and confidence from project evidence, never from examples.

```markdown
| WAF Pillar | Score | Confidence | Key Factor |
| --- | --- | --- | --- |
| {pillar} | {evidence-based score}/10 | {confidence} | {verified factor} |
```
