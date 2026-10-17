## CHM-03: verify custom-agent discovery and definition-owned routing

Related: [PR #767](https://github.com/jonathan-vella/apex/pull/767).
GitHub: [#773](https://github.com/jonathan-vella/apex/issues/773).
Requirements: R1, R4. Priority: P0. Depends on: CHM-02 (#771).
Suggested executor: human-assisted runtime validation agent.

### Objective and inputs

Verify live discovery, model/effort routing, permitted tools, and same-worker continuation in VS Code.
Inputs are CHM-02's candidate revision and source results, current `.github/agents/` definitions,
the model catalog, canonical entry skills, and the current worker-readiness contract.
Baseline commit: `ee2712cc341ad0cc19a4b21ba9bf3701ce5aefcd`.

### Prerequisites and allowed scope

The operator explicitly selects the top-level runtime, approves the tool-free handshake scope and budget,
and supplies the exact current session log path. Reload definitions when required.
Read definitions and record redacted readiness evidence in a caller-approved location.
No worker execution envelope, Azure action, credential change, or production artifact write is authorized.
Issue assignment is not approval to start workers.

### Activities

1. Inventory all intended manual entry skills, main definitions, and leaf definitions from current sources.
   Identify allowed parent/worker relationships; do not hard-code an inventory count.
2. Observe actual discovery and invocation eligibility, including human-selected-only Orchestrator behavior.
3. For each required delegated definition, follow
   `.github/skills/apex-workflow-engine/references/worker-readiness.md` exactly.
4. Use tool-free background handshakes with fresh nonces; leave model, effort, and context overrides unset.
5. Require attributed definition-owned routing, exact effort, parent/call identity, background configuration,
   zero worker tools, `MODEL_VERIFIED`, and nonce-only same-worker continuation ACK.
6. Record tool availability/binding metadata without executing project work.
7. Return a revision-bound matrix covering every required definition; mark unavailable or unknown rows blocking.

### Acceptance criteria

- [ ] All intended definitions and manual entry skills have explicit discovery observations.
- [ ] Required workers have attributed model/effort, parent/call identity, and permitted tool metadata.
- [ ] Every required readiness and ACK turn is tool-free and bound to the same worker and nonce.
- [ ] `verify-worker-ready.mjs` evidence is recorded for each required delegated definition.
- [ ] No parent-model inheritance, caller override, unsupported model, or built-in probe is accepted as proof.
- [ ] No required matrix row is UNKNOWN or BLOCKED when the issue is closed.
- [ ] No project execution occurred during readiness testing.

### Validation and return

Use `npm run verify:worker-ready --` with the explicit current native log, exact definition,
worker ID, and parent ID required by the current contract.
Return the readiness matrix, redacted evidence paths, environment and candidate revision, and any blocker.
If runtime discovery, attribution, routing, or continuation fails, stop; do not relaunch project work
under a substitute model. Findings requiring source changes become separately scoped tasks.
