<!-- ref:safeguards-v1 -->

# AKS Deployment Safeguards Reference

Deployment Safeguards (Azure Policy initiative `c047ea8e-…`) check workloads at admission. Use this checklist
when designing clusters and workloads that will run with Safeguards enabled. The Auto-Fix column describes the
upstream app-deploy workflow, which APEX does not import; treat it as a hint for how to make a manifest compliant.

## DS001 — Resource Limits Required (Error)

Every container needs `resources.requests` AND `resources.limits` for both `cpu` and `memory`.

## DS002 — Liveness Probe Required (Warning)

Every container needs a `livenessProbe`. Use `httpGet`, `tcpSocket`, or `exec`.

## DS003 — Readiness Probe Required (Warning)

Every container needs a `readinessProbe`.

## DS004 — runAsNonRoot Required (Error)

Set at **both** pod and container level.

## DS005 — No hostNetwork (Error)

Remove `hostNetwork: true` or set to `false`.

## DS006 — No hostPID (Error)

Remove `hostPID: true` or set to `false`.

## DS007 — No hostIPC (Error)

Remove `hostIPC: true` or set to `false`.

## DS008 — No Privileged Containers (Error)

Remove `securityContext.privileged: true` or set to `false`.

## DS009 — No :latest Image Tag (Error, NOT auto-fixable)

Use a semantic version, git SHA, or digest — never `:latest` or omit the tag.

## DS010 — Minimum 2 Replicas (Warning)

Set `spec.replicas: 2` or higher. Pair with a PodDisruptionBudget.

## DS011 — allowPrivilegeEscalation: false (Error)

Every container must set `securityContext.allowPrivilegeEscalation: false`.

## DS012 — readOnlyRootFilesystem: true (Warning)

Every container must set `securityContext.readOnlyRootFilesystem: true`.

If the app writes to specific paths, mount `emptyDir` volumes:

```yaml
volumes:
  - name: tmp
    emptyDir: {}
containers:
  - volumeMounts:
      - name: tmp
        mountPath: /tmp
```

Common writable paths: Spring Boot `/tmp`, ASP.NET `/tmp`, Django `/tmp`, Express `/tmp`, Go `/tmp`.

## DS013 — automountServiceAccountToken: false (Warning)

Set `spec.automountServiceAccountToken: false`. Set to `true` only if the app genuinely calls the K8s API (scope with RBAC).

---

## Quick Reference

| Rule | What | Severity | Auto-Fix |
|------|------|----------|----------|
| DS001 | Resource limits | Error | Yes |
| DS002 | Liveness probe | Warning | Yes |
| DS003 | Readiness probe | Warning | Yes |
| DS004 | runAsNonRoot | Error | Yes |
| DS005 | No hostNetwork | Error | Yes |
| DS006 | No hostPID | Error | Yes |
| DS007 | No hostIPC | Error | Yes |
| DS008 | No privileged | Error | Yes |
| DS009 | No :latest tag | Error | No |
| DS010 | Min 2 replicas | Warning | Yes |
| DS011 | No privilege escalation | Error | Yes |
| DS012 | Read-only root FS | Warning | Yes |
| DS013 | No SA token mount | Warning | Yes |
