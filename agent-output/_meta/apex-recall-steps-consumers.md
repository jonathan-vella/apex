# `apex-recall` `.steps` Consumers Audit

> Phase F1c of the nordic-foods lessons plan. Inventory of all
> `session.steps` / `.steps[` / `steps.N` consumers across this repo,
> captured before merging the F1a fix (adding `steps` to `show.py`
> output). The audit is a one-shot exercise — re-run only when the
> session-state schema changes.

## Method

```bash
# Run from repo root, both patterns covered
grep -rEn '\\.steps\\[|session\\.steps|\\.steps\\.' \
  --include='*.md' --include='*.mjs' --include='*.py' --include='*.sh' \
  .github/ tools/
```

## Findings (2026-05-13)

### Active consumers

| File | Line | Pattern | Note |
| ---- | ---- | ------- | ---- |
| `.github/agents/07b-bicep-deploy.agent.md` | ~261 | `steps.5.status` (prose only) | Documents the skip-validation shortcut. Now also carries a canonical jq snippet. |
| `tools/scripts/validate-session-state.mjs` | 242 | `state.steps[key]` | Reads from `00-session-state.json` directly (not via show.py). Already key-aware — string keys. Safe. |

### Tooling that emits `steps`

| File | Role |
| ---- | ---- |
| `tools/apex-recall/src/apex_recall/state_writer.py` | Writes `steps` map to session-state JSON. Authoritative. |
| `tools/apex-recall/src/apex_recall/commands/show.py` | **F1a fix** — now emits `steps` (default `{}`) in show output. |
| `tools/apex-recall/docs/show-schema.md` | Documents the contract. |
| `tools/apex-recall/tests/test_show_steps.py` | Regression test. |

### Documentation references

The remaining matches in `.github/prompts/plan-applyNordicFoodsLessons.prompt.md`
are inside this very plan — they document the bug, not exercise it.

## Risk assessment

The F1a change (adding `"steps": data.get("steps", {})` to `show.py`)
is **non-breaking**:

- Previously: `show.session.steps` was **absent**. `jq '.session.steps'`
  yielded `null`. `jq '.session.steps | to_entries[]'` errored.
- After F1a: `show.session.steps` is `{}` (empty object) on a fresh
  project, and the populated map otherwise. `jq '.session.steps'`
  yields `{}` or the map. `jq '.session.steps | to_entries[]'` yields
  zero or more entries, never an error.

No consumer was reading `.session.steps` and would break by suddenly
finding `{}` where it expected `null` — both shapes are falsy for
boolean checks, both safe for iteration. The validate-session-state.mjs
consumer reads from the JSON file directly and is unaffected.

## Conclusion

F1a is safe to merge. F1b (jq query updates in deploy agents) is now
in place to give agents a canonical, schema-aware query template.
