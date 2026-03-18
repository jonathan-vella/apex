# Azure Developer CLI — Quick Reference

> Condensed from **azd-deployment**. Full patterns (Bicep modules,
> hooks, RBAC post-provision, service discovery, idempotent deploys)
> in the **azd-deployment** plugin skill if installed.

## Install

> **Security note**: Piping a remote script directly into `bash` carries supply-chain risk.
> For a more auditable approach, download the script first, review it, then execute:
>
> ```bash
> curl -fsSL https://aka.ms/install-azd.sh -o install-azd.sh
> less install-azd.sh   # review before running
> bash install-azd.sh
> ```
>
> Alternatively, use your OS package manager (`winget install microsoft.azd`, `brew install azd`).

```bash
# Quick install (trusts the remote script)
curl -fsSL https://aka.ms/install-azd.sh | bash
```

## Quick Start
```bash
azd auth login
azd init
azd up    # provision + build + deploy
```

## Best Practices
- Always use remoteBuild: true — local builds fail on ARM Macs deploying to AMD64
- Bicep outputs auto-populate .azure/<env>/.env — don't manually edit
- Use azd env set for secrets — not main.parameters.json defaults
- Service tags (azd-service-name) are required for azd to find Container Apps
- Use `|| true` in hooks — prevent RBAC "already exists" errors from failing deploy
