## PR feedback register

Observed on 2026-10-18 for [APEX #779](https://github.com/jonathan-vella/apex/pull/779).
This register schedules actual feedback; a plan or issue link is not a delivered fix.
The owner approved implementation on 2026-10-18 at 10:18 UTC.
Threads remain open until actual tested fixes are delivered; approval is not evidence of a fix.

| Feedback                                                                                                                    | Owning packet  | Required verification                                             | Disposition now                                       |
| --------------------------------------------------------------------------------------------------------------------------- | -------------- | ----------------------------------------------------------------- | ----------------------------------------------------- |
| [Shared direct-dispatch/handshake conflict](https://github.com/jonathan-vella/apex/pull/779#discussion_r4304423555)         | CHM-11, CHM-15 | Consistent entry/global/role guidance and existing contract tests | Implemented; integration checks pass                  |
| [Startup skill handshake conflict](https://github.com/jonathan-vella/apex/pull/779#discussion_r4304423593)                  | CHM-11         | Direct dispatch no longer requires diagnostic handshake           | Implemented; integration checks pass                  |
| [Root continuation requirement](https://github.com/jonathan-vella/apex/pull/779#discussion_r4304423620)                     | CHM-11, CHM-15 | Native lifecycle/one-shot/continuation tests                      | Implemented; integration checks pass                  |
| [Manual review batch vs automatic per-pass outputs](https://github.com/jonathan-vella/apex/pull/779#discussion_r4304423630) | CHM-13         | Preserve actual single-file manual batch output                   | Implemented; review contract checks pass              |
| [Changelog dispatch guidance](https://github.com/jonathan-vella/apex/pull/779#discussion_r4304423653)                       | CHM-16         | Guidance matches direct dispatch without model attestation        | Implemented; integration checks pass                  |
| [Unsupported model attestation claim](https://github.com/jonathan-vella/apex/pull/779#discussion_r4304423676)               | CHM-16         | No model-label proof claim                                        | Implemented; integration checks pass                  |
| Advisory warning may inject verdict tokens into worker response                                                             | CHM-05, CHM-13 | Remove mutating advisory and active callers                       | Retired by owner decision; config/negative tests pass |
| Terraform deploy agent implicit invocation/authority                                                                        | CHM-10, CHM-11 | Real permission/credential boundary, not only a visibility flag   | Blocking implementation feedback; no fix claimed      |
| Bicep deploy agent implicit invocation/authority                                                                            | CHM-10, CHM-11 | Same boundary with track-specific negative tests                  | Blocking implementation feedback; no fix claimed      |

Do not implement a suggested field/payload change solely because a reviewer named it:
verify the actual Copilot adapter contract, preserve useful outcomes and test the failure case.
Do not treat a native invocation flag as proof the parent lacks write credentials.

### Additional feedback on the planning revision

- [Repeated advisory-token finding](https://github.com/jonathan-vella/apex/pull/779#discussion_r4306599684):
  CHM-05 and CHM-13 retain ownership. Test the real adapter contract and keep warning text out of trusted verdicts.
- [Diagnostic invocation and approval channel](https://github.com/jonathan-vella/apex/pull/779#discussion_r4306599689):
  CHM-10 and CHM-11 cover consequential diagnostic/remediation authority and actual parent-mediated input.
  Include related design/as-built/manual-review entry points in the bounded role audit.
  Do not assume restoring a suggested tool name or invocation flag alone proves a genuine approval boundary.

Both remain unresolved until actual source fixes and negative tests are delivered.
Later duplicate findings about the same unchanged mechanism retain these packet owners and blocked disposition;
do not repeatedly rewrite the plan or claim an implementation fix to silence an automated review.

### Execution updates

The owner intentionally deleted repository runtime hooks. The advisory-result contamination fix is now
retirement plus caller cleanup, not the earlier proposed warning patch. No retired hook is restored.
Root/authoring/startup shared guidance now distinguishes direct `WORKER_EXECUTE` attribution from
diagnostic handshake/ACK. Model labels remain diagnostics. Manual deep batch guidance now preserves
its actual consolidated output instead of promising nonexistent per-pass files.
Resolve the corresponding threads only after the integrated checks and pushed revision are evidenced.
Deploy/diagnostic authority and full architecture simplification are not certified by these bounded fixes.

### Documentation companion

[jonathan-vella/apex-docs#43](https://github.com/jonathan-vella/apex-docs/pull/43)
had no inline review threads when inspected.
Its planning correction distinguishes the proposed VS Code-only target, current behavior, owner approval,
Autopilot authorization limits and unresolved runtime acceptance. Site publication is not authorized.

### Ongoing review loop

The later full-body slice adds native `ask_user` and direct/delegated interaction to every main,
including Diagnose, and removes active UI handoffs/custom worker readiness throughout the fleet.
Source tests and full source-only validation pass; actual missing-input probes for the core interactive
roles pass. Current-session what-if/plan/cost probes still differ from source and require fresh-session
confirmation; no credential-isolation or full runtime-readiness claim follows from source validation.

After each approved packet: fetch current comments/checks, classify relevant feedback, fix within scope,
run focused tests, push the feature branch and reply with the actual evidence.
Resolve only actually addressed threads; retain deferred/blocked work visibly.
Do not request predetermined approval, close the issue by inference, merge, or enable auto-merge.
