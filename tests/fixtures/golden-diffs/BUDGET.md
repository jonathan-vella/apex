# Budget — golden-diffs fixture

Snapshot fixture holding committed `before/`, `after/`, and `expected/`
trees used to verify Wave 1+ contract emission and Wave 3+ handoff
generation produce stable, deterministic output. The fixture is run by
`bench:drawio-diff` and the planned `bench:iac-handoff-diff` scripts.

- **Monthly budget (USD)**: 0 (no real resources; CI-only fixture)
- **Forecast alerts**: n/a
- **Anomaly detection**: n/a
- **Owner contact**: `platform-team@example.local`

All IDs and emails inside `before/` / `after/` are placeholder GUIDs
(`00000000-0000-0000-0000-000000000000`) and `example.local` addresses.
