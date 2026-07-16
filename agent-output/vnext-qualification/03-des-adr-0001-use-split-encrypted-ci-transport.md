# ADR-0001: Use Split Encrypted CI Transport

![Step](https://img.shields.io/badge/Step-3-blue?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-Accepted-brightgreen?style=for-the-badge)
![Type](https://img.shields.io/badge/Type-ADR-purple?style=for-the-badge)

<details open>
<summary><strong>📑 Decision Contents</strong></summary>

- [🔍 Context](#-context)
- [✅ Decision](#-decision)
- [🔄 Alternatives Considered](#-alternatives-considered)
- [⚖️ Consequences](#%EF%B8%8F-consequences)
- [🏛️ WAF Pillar Analysis](#%EF%B8%8F-waf-pillar-analysis)
- [🔒 Compliance Considerations](#-compliance-considerations)
- [📝 Implementation Notes](#-implementation-notes)

</details>

> Status: Accepted
> Date: 2026-07-15
> Deciders: jonathan-vella

## 🔍 Context

Issues [#543](https://github.com/jonathan-vella/apex/issues/543) and
[#544](https://github.com/jonathan-vella/apex/issues/544) require a local APEX writer to transfer authority into a
GitHub Environment-protected OIDC workflow and require Terraform apply to consume the exact approved encrypted plan.
The transfer must bind repository, branch, commit, workflow, writer epoch, recipient, state head, expiry, and hashes.

APEX repository state is confidential and must not be pushed as synthetic Git history. GitHub Actions artifacts are
created by workflow jobs and are well suited to passing immutable data between preview and apply jobs, but they do not
provide a supported local-producer upload path. Azure Blob supports Microsoft Entra authorization and container-scoped
RBAC for both the local user and the OIDC service principal.

The selected backend has a bounded sandbox exception for one ephemeral GitHub-hosted runner `/32`. Shared-key access and
public blob access remain disabled.

## ✅ Decision

Use two encrypted transports with distinct ownership boundaries:

1. **Local writer to CI:** package the minimum repository-backed APEX run state and pending writer-transfer claim into a
   deterministic envelope. Encrypt it with AES-256-GCM for the intended workflow recipient and upload it to a dedicated
   `handoff` Blob container using Microsoft Entra authentication. The `incoming/<handoff-id>.json` rendezvous name binds
   the dispatch UUID; authenticated envelope metadata binds the candidate commit, writer epoch, recipient, expiry, and
   content hashes. The CI job downloads it after OIDC login, verifies and accepts the claim, imports state atomically,
   and deletes the blob after successful acceptance.
2. **CI preview to CI apply:** keep Terraform preview and apply in one workflow run. The preview job encrypts the saved
   plan immediately, uploads only the encrypted envelope through `actions/upload-artifact@v4`, and records the action
   digest plus APEX attestation. The Environment-protected apply job downloads the named artifact, verifies every binding,
   decrypts to a mode-0600 temporary file, applies that exact plan, and disposes the plaintext.
3. **Key boundary:** use the locally generated mode-0600 APEX transport key. Install the same value as an Environment
   secret without printing it. Neither Azure Blob nor Actions artifacts contain the key. Rotation invalidates outstanding
   envelopes and requires a new preview or writer transfer.
4. **Network boundary:** backend public network access is Disabled at rest and the firewall defaults to Deny. A
   session starts only when the approved exception has at least 75 minutes remaining. It applies the policy's official
   exclusion tag, enables the endpoint, and adds one runner `/32`. Cleanup removes the rule, restores Disabled, removes
   the tag, and verifies both states. Apply first verifies the preview rule is absent. The exception expires on
   `2026-07-16T12:50:34Z`.
5. **Production boundary:** this decision qualifies a non-production sandbox only. Production CI apply remains disabled
   until live substitution, stale-state, wrong-recipient, expiry, cleanup, and exact-plan tests pass.

## 🔄 Alternatives Considered

| Option | Pros | Cons | WAF Impact |
| --- | --- | --- | --- |
| Commit APEX state to a qualification branch | Native Git transfer and audit | Violates the no-synthetic-state boundary and exposes confidential run history | Security ↓, Operations ↑ |
| Use Actions artifacts for both transfers | One platform and built-in digest | No supported local producer path; artifacts are workflow-job outputs | Reliability ↓, Operations ↑ |
| Put state or plan in GitHub secrets | Easy workflow retrieval | Poor artifact semantics, size limits, rotation coupling, and no content-addressed lifecycle | Security ↓, Operations ↓ |
| Use one encrypted Azure Blob transport for everything | Supports local and CI producers | Loses Actions environment/job artifact evidence and adds more storage lifecycle logic | Reliability ↑, Operations ↓ |
| Provision a self-hosted VNet runner | Private-only backend connectivity | Adds compute, patching, runner trust, cost, and cleanup beyond the bounded qualification | Security ↑, Cost ↓, Operations ↓ |
| Use split Blob and Actions artifact transport | Fits each producer boundary and keeps exact hashes | Requires two adapters and explicit key/lifecycle coordination | Security ↑, Reliability ↑ |

## ⚖️ Consequences

### Positive

- No repository state, plaintext Terraform plan, account key, or transport key enters Git or an artifact.
- Local-to-CI transfer uses Entra ID and container-scoped data access.
- Preview-to-apply evidence uses immutable Actions artifacts with platform digest validation plus APEX attestation.
- Wrong recipient, stale writer, changed source, changed lock, expiry, and artifact substitution can fail closed.

### Negative

- The qualification needs a temporary public-endpoint exception with an ephemeral firewall rule.
- Key rotation and failed cleanup require explicit recovery procedures.
- Azure RBAC propagation can delay the first live run.
- Two transport adapters increase test and operational surface.

### Neutral

- The Terraform backend remains Azure Blob and uses its lease for state locking.
- Human GitHub Environment approval remains separate from APEX Gate 4 approval evidence.
- The decision does not authorize deployment, production apply, publication, or merge to `main`.

## 🏛️ WAF Pillar Analysis

| Pillar | Impact | Notes |
| --- | --- | --- |
| Security | ↑ | Entra-only data access, recipient-bound encryption, narrow RBAC, no Git state, and expiring `/32` access |
| Reliability | ↑ | Content hashes, immutable CI artifacts, exact-plan apply, state locking, and atomic import |
| Performance | → | Small encrypted envelopes; control-plane and artifact latency are acceptable for qualification |
| Cost | → | LRS Blob and short retention are low cost; no self-hosted runner is introduced |
| Operations | → | More lifecycle steps, offset by deterministic adapters, cleanup, and auditable evidence |

## 🔒 Compliance Considerations

- Applies the discovered lowercase resource-group tag contract and `tech-contact` compatibility tag.
- Uses `swedencentral` for all Azure resources; the inherited allowed-locations assignment is Audit and explicitly
   allows `swedencentral`.
- Shared-key authorization and anonymous blob access remain disabled.
- Raw chat history, credentials, Terraform state, and plaintext plans are excluded from retained evidence.
- Evidence records the self-review limitation of this single-maintainer sandbox.

## 📝 Implementation Notes

- Add a generic encrypted state-envelope adapter rather than rebranding plan-specific metadata.
- Store handoff blobs in a dedicated container with versioning, seven-day soft delete, explicit post-acceptance deletion,
   and no anonymous access.
- Scope `Storage Blob Data Contributor` to the handoff/state container where supported.
- Keep `Storage Account Contributor` at the backend account only for temporary firewall management.
- Use `actions/upload-artifact@v4` and `actions/download-artifact@v4`; bind the upload action digest into APEX evidence.
- Bound the local-to-preview claim to two hours and its state envelope to one hour. Bound the preview-to-apply claim to
   90 minutes and both encrypted apply envelopes to one hour. Bound return claims to one hour and return envelopes to
   50 minutes.
- Reject a missing cleanup record even when apply succeeds; cleanup failure leaves the run incomplete.
- Treat the Environment secret key as deployment-time input. Never echo it or include it in provider configuration.
- Re-run live qualification after every candidate or dependency hash change.
- Keep the dispatch-only workflow on the default branch as a separately reviewed bootstrap; execution remains bound to
   the exact integration-branch candidate SHA.

---

<div align="center">

| ⬅️ Previous ADR | 🏠 [Project Index](README.md) | Next ADR ➡️ |
| --- | --- | --- |
| None | [README](README.md) | None |

</div>
