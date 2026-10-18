## PR feedback register

Observed on 2026-10-18 for [APEX #779](https://github.com/jonathan-vella/apex/pull/779).
This register schedules actual feedback; a plan or issue link is not a delivered fix.
The owner selected planning first and approval before implementation, so implementation threads remain open.

| Feedback                                                                                                                    | Owning packet  | Required verification                                                 | Disposition now                                  |
| --------------------------------------------------------------------------------------------------------------------------- | -------------- | --------------------------------------------------------------------- | ------------------------------------------------ |
| [Shared direct-dispatch/handshake conflict](https://github.com/jonathan-vella/apex/pull/779#discussion_r4304423555)         | CHM-11, CHM-15 | Consistent live entry/global/role guidance and behavior tests         | Deferred until implementation approval           |
| [Startup skill handshake conflict](https://github.com/jonathan-vella/apex/pull/779#discussion_r4304423593)                  | CHM-11         | Accepted entry path does not require diagnostic ceremony              | Deferred until implementation approval           |
| [Root continuation requirement](https://github.com/jonathan-vella/apex/pull/779#discussion_r4304423620)                     | CHM-11, CHM-15 | Native lifecycle/one-shot/continuation tests                          | Deferred until implementation approval           |
| [Manual review batch vs automatic per-pass outputs](https://github.com/jonathan-vella/apex/pull/779#discussion_r4304423630) | CHM-13         | Actual output contract and historical reader tests                    | Deferred until implementation approval           |
| [Changelog dispatch guidance](https://github.com/jonathan-vella/apex/pull/779#discussion_r4304423653)                       | CHM-16         | Current migration advice matches delivered behavior                   | Deferred until implementation approval           |
| [Unsupported model attestation claim](https://github.com/jonathan-vella/apex/pull/779#discussion_r4304423676)               | CHM-16         | No model-label proof claim; historical facts preserved                | Deferred until implementation approval           |
| Advisory warning may inject verdict tokens into worker response                                                             | CHM-05, CHM-13 | Missing verdict stays invalid; advisory does not manufacture approval | Blocking implementation feedback; no fix claimed |
| Terraform deploy agent implicit invocation/authority                                                                        | CHM-10, CHM-11 | Real permission/credential boundary, not only a visibility flag       | Blocking implementation feedback; no fix claimed |
| Bicep deploy agent implicit invocation/authority                                                                            | CHM-10, CHM-11 | Same boundary with track-specific negative tests                      | Blocking implementation feedback; no fix claimed |

Do not implement a suggested field/payload change solely because a reviewer named it:
verify the actual Copilot adapter contract, preserve useful outcomes and test the failure case.
Do not treat a native invocation flag as proof the parent lacks write credentials.

### Documentation companion

[jonathan-vella/apex-docs#43](https://github.com/jonathan-vella/apex-docs/pull/43)
had no inline review threads when inspected.
Its planning correction distinguishes the proposed VS Code-only target, current behavior, owner approval,
Autopilot authorization limits and unresolved runtime acceptance. Site publication is not authorized.

### Ongoing review loop

After each approved packet: fetch current comments/checks, classify relevant feedback, fix within scope,
run focused tests, push the feature branch and reply with the actual evidence.
Resolve only actually addressed threads; retain deferred/blocked work visibly.
Do not request predetermined approval, close the issue by inference, merge, or enable auto-merge.
