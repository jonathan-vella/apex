## CHM-15: separate native/domain correctness from prose policy

GitHub: [#786](https://github.com/jonathan-vella/apex/issues/786).
Requirements: R7, R10, R12. Priority: P1. Depends on: CHM-04 and owner pilot acceptance.
Status: proposed implementation; current rules are not waived by this planning packet.

### Objective and inputs

Permit simpler target roles while retaining genuine frontmatter/reference/schema/build/security checks.
Read `validate-agents.mjs`, `validate-artifacts.mjs`, relevant `_lib` helpers, authoring/vendor/context/count
instructions/skills and their actual tests. Identify each rule's owner and useful outcome before removing it.

### Allowed scope and behavior

Separate slices for agent prose policy, instruction loading and artifact cosmetics.
Edit only selected rule sections, their direct instruction/skill/test callers and package/lefthook/CI bindings.
Keep native structural validation, Azure baselines, schema/diagram/link integrity, secrets and compiler checks.
Make vendor XML skeletons, arbitrary body/read caps, density/count phrase bans and cosmetic H2 checks
optional advice or retire them after proving useful coverage elsewhere.
Do not directly lint or rewrite historical `agent-output` artifacts.

### Validation

For agent slices run `npm run validate:agents`, `npm run test:classify-model`,
`npm run test:vendor-prompting`, `npm run test:workflow-handoffs`.
For instruction/skill slices run the relevant existing instruction/skill validators and tests.
For cosmetic slices test retained governance AJV/diagram/link checks through fixtures/appropriate owners.
Use `npm run lint:links` for link integrity; keep pre-existing project failures explicit.

Negative cases: malformed YAML, unknown tool/agent, invalid schema, broken diagram/link and missing security
property still fail. Safe equivalent prose, optional native fields and valid information with different
cosmetic headings pass. Do not delete tests that actually execute recipe/code samples merely by filename.

### Acceptance and evidence

- [ ] Every changed rule is classified native, domain, structural or optional authoring convention.
- [ ] Useful behavior remains blocking; obsolete exact-wording assertions retire in the same slice.
- [ ] Root/scoped/on-demand guidance ownership is clear, with no broad vendor guidance load at runtime.
- [ ] Caller/test/package/hook/CI references are consistent after each slice.

Return rule map, positive/negative evidence, changed scope and rollback boundary.
Stop if an apparent cosmetic requirement has an unaccounted technical consumer.
No merge, auto-merge, production gate bypass or project-state repair.
