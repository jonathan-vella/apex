# MCP Recipe Evaluation

Updated 2026-09-14. The hand-written JSON-RPC servers have been replaced with
official Functions bindings or SDK-hosted tool logic. Source remediation is
implemented; native deployment and protocol acceptance are not yet verified.

## Evidence By Runtime

| Runtime | Implemented source | Executed evidence | Remaining verification |
| --- | --- | --- | --- |
| Python | Functions 1.24.0 decorators; MCP 1.26.0 local host | Stubbed registration, required property metadata, demo/validation/health behavior, syntax | Real SDK suite skipped; native Functions indexing and HTTP/auth |
| JavaScript | Functions 4.9.0 bindings; MCP SDK 1.26.0 local host | Syntax and stubbed registration/tool validation/health | Real SDK suite skipped; native Functions indexing and HTTP/auth |
| TypeScript | Functions 4.9.0 bindings, compiler pin 5.9.3 | Non-executing parser and source contract checks | Execution denied; SDK typecheck/build and native HTTP/auth |
| .NET | Worker 2.1.0, MCP extension 1.0.0 attributes | Source attribute and required-property checks | Native compiler unavailable; build and host/client checks |
| Java | Library 3.2.2, Maven plugin 1.40.0 annotations | Source annotation and required-property checks | Native compiler unavailable; package/indexing and host/client checks |
| PowerShell | PowerShell tool script behind Node MCP SDK | Actual script results, invalid inputs and literal shell-like data | SDK host handshake skipped; native Functions PowerShell MCP binding is unsupported |

Historical direct-call results remain in [python.md](python.md). They concern
the removed dispatcher and do not establish MCP initialization or conformance.

## Focused Checks

```bash
node --test --test-name-pattern='SK-14' tools/tests/scripts/test_recipe_remediation.mjs
```

The default run executes available source/behavior checks and explicitly skips
real SDK suites if their dependencies are absent. A skip must not be recorded
as a passed handshake. SDK suites exercise actual SDK clients and transports,
including initialized notifications, inputSchema/content, tool/protocol errors,
version negotiation, auth rejection and cleanup. No stub is used for their protocol.
Dependency provisioning and invocation are described in the
[README](../README.md#verification-gate); tests themselves never install packages.

## Approval And Environment Limits

- Public Microsoft/SDK source documentation was fetched read-only.
- Temporary npm and pip SDK installations were denied by tool approval policy.
	No alternate downloader, external execution service or privileged retry was used.
- A TypeScript execution command was also denied. Non-executing parsing was used
	instead; a parser pass is not an SDK typecheck or runtime pass.
- Node, Python, PowerShell and a repository-local TypeScript parser were available.
	MCP/Functions SDKs, Core Tools, .NET and Java compilers were unavailable.
- No Azure writes, paid model calls, deployment, secret configuration, ledger
	changes, commits or full validation suite were performed for this remediation.

## Track Limitations

Both Bicep and Terraform still need native runtime packaging, extension loading,
transport lifecycle and deployed authentication verification. The recipe now
supplies supported application integration patterns; it does not claim that either
IaC track was deployed or that local SDK tests prove the Functions host transport.
PowerShell's local Node-hosted alternative preserves tool capability but cannot
be represented as a native PowerShell Functions binding on either track.
