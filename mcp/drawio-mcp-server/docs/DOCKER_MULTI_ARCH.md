# Multi‑Architecture Docker Builds

Build and publish the `drawio-mcp-server` image for `linux/amd64` + `linux/arm64` under a single tag.

---

## TL;DR

```powershell
# 1. Configure (one time) — compose reads .env automatically
cp .env.example .env          # then edit REGISTRY, IMAGE_VERSION

# 2. Login
docker login ghcr.io          # or docker.io / your ACR

# 3. Run the script
./build-push.ps1      # Windows
./build-push.sh       # Linux / macOS
```

The script runs preflight checks, builds **both arches into cache**, reports success, then **prompts before pushing**. Declining leaves the build cached — re-running later is a no-op rebuild + instant push.

| Flag                      | Behaviour                                                                                                                                                              |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| _(none)_                  | preflight → build → report → **prompt y/N** → push. If the Docker daemon is down, prompts to launch Docker Desktop and polls until the engine answers (120 s timeout). |
| `-Force` / `--force`      | yes-to-all: auto-start Docker if down, push without asking. CI.                                                                                                        |
| `-Clean` / `--clean`      | `--no-cache --pull` on the build phase — rebuild every layer, re-fetch base images. The push phase still cache-hits the fresh layers.                                  |
| `-Help` / `--help` / `-h` | print usage table and exit                                                                                                                                             |

Flags combine: `-Clean -Force` = cold release build. For a local smoke test without any of this, just run `docker compose up --build` directly (host arch only, runs the container).

### `.env` knobs (read by compose)

| Variable        | Example                   | Purpose                                 |
| --------------- | ------------------------- | --------------------------------------- |
| `REGISTRY`      | `ghcr.io/simonkurtz-msft` | Where to push. **Required.**            |
| `IMAGE_NAME`    | `drawio-mcp-server`       | Repository path (optional, has default) |
| `IMAGE_VERSION` | `3.0.1`                   | Version tag (also tagged `latest`)      |

Platforms (`linux/amd64`, `linux/arm64`) live in `docker-compose.yml` under `build.platforms` — edit there if you need to add or drop one.

---

## What "multi-arch" means here

| Target          | Supported | Notes                                                                                                               |
| --------------- | :-------: | ------------------------------------------------------------------------------------------------------------------- |
| `linux/amd64`   |    ✅     | Intel/AMD 64‑bit. Standard cloud VMs, most dev machines, WSL2.                                                      |
| `linux/arm64`   |    ✅     | Apple Silicon, AWS Graviton, Ampere Altra, Raspberry Pi 4/5 (64‑bit OS).                                            |
| `linux/arm/v7`  |    ❌     | Deno does not ship a 32‑bit ARM build. Not supportable.                                                             |
| `windows/amd64` |    ⚠️     | Requires a **separate Dockerfile** (Nanoserver base, `.exe` binary). See [Windows containers](#windows-containers). |

> **Reality check:** 99% of container workloads — including Docker Desktop on Windows and macOS — run **Linux** containers. `linux/amd64` + `linux/arm64` covers every mainstream deployment target. Native Windows containers are a niche requirement; do not build them unless you have a hard constraint.

---

## Why no Dockerfile changes are needed

The existing [`Dockerfile`](../Dockerfile) is already architecture-agnostic:

1. **`denoland/deno:2.7.4`** is a multi-arch manifest (amd64 + arm64).
2. **`gcr.io/distroless/cc-debian12:nonroot`** is a multi-arch manifest (amd64 + arm64 + more).
3. `deno compile` runs **inside** the emulated build container, so it naturally produces a binary for the target architecture — no `--target` cross-compilation flag needed.
4. No hardcoded arch-specific paths, no `uname` shenanigans.

BuildKit pulls the correct base-image variant for each `--platform` value and the `RUN deno compile …` step executes under QEMU for the foreign architecture. The output binary matches the platform automatically.

---

## How it works

All build configuration lives in `docker-compose.yml`:

- `build.platforms` lists the target arches — Compose hands the list to BuildKit.
- `build.tags` and `image` interpolate `${REGISTRY}`, `${IMAGE_NAME}`, `${IMAGE_VERSION}` straight from `.env` (Compose loads `.env` automatically — no sourcing needed).
- `${REGISTRY:?…}` uses the required-variable syntax so a missing registry fails loudly at parse time, not mid-push.

The helper scripts orchestrate a **safe two-phase** publish:

| Phase     | Command                                  | What happens                                                                                                                                     |
| --------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Preflight | `docker info`, `compose config --images` | CLI present? Daemon up? `.env` valid? Builder ready?                                                                                             |
| Build     | `docker compose build`                   | Compiles **all** platforms into the buildx cache. The "No output specified" warning is expected — we're deliberately not loading or pushing yet. |
| Confirm   | `Read-Host` / `read -p`                  | Shows the resolved tags, asks y/N. Default is **No**.                                                                                            |
| Push      | `docker compose build --push`            | 100% cache hit from the build phase — this is just manifest-list assembly + upload.                                                              |

The result is a **manifest list** — `docker pull` auto-selects the right arch on the client.

> **Why build twice?** Multi-platform output can _only_ leave the builder via `--push` (the classic image store holds one arch). The first pass proves the build is good without touching the registry. The second pass re-uses every cached layer, so "push" really is just push.

### Preflight checks

The script fails fast with an actionable message if:

- `docker` is not on `PATH`
- The Docker daemon is not running (`docker info` fails)
- `.env` is missing
- `.env` is missing `REGISTRY` (caught by compose's `${REGISTRY:?…}` guard)
- The `multiarch` buildx builder doesn't exist → **auto-created**
- QEMU binfmt handlers for amd64/arm64 aren't registered → **auto-registered** via `tonistiigi/binfmt`

> **Why the binfmt step exists.** Docker Desktop on x64 pre-registers arm64 emulation (the common "Intel laptop wants to build Apple-Silicon images" case). Docker Desktop on **Windows ARM64** does _not_ pre-register amd64 — it's a newer, rarer platform and the install step was missed. Without it, the first foreign-arch `RUN` step dies with `exec /bin/sh: exec format error`. Registrations are also kernel-scoped and **do not survive `wsl --shutdown`**, so the preflight probes and re-registers on every run.

> **Why `BUILDX_BUILDER` is exported.** `docker buildx use <name>` only affects the `docker buildx …` CLI namespace. `docker compose build` has its own builder selection and ignores that setting — it silently falls back to the default daemon builder. On a machine where the default builder can't emulate the foreign arch, that's a guaranteed `exec format error`. Exporting `BUILDX_BUILDER` is the documented way to route compose through a specific builder.

### Bare Linux CI hosts

The preflight's binfmt auto-registration handles this too — no extra step needed.

---

## Verifying the published manifest

```bash
docker buildx imagetools inspect ghcr.io/simonkurtz-msft/drawio-mcp-server:3.0.1
```

Expected output (abridged):

```text
Name:      ghcr.io/simonkurtz-msft/drawio-mcp-server:3.0.1
MediaType: application/vnd.oci.image.index.v1+json

Manifests:
  Platform:    linux/amd64
  Platform:    linux/arm64
```

Smoke-test each variant explicitly:

```bash
docker run --rm --platform linux/amd64 ghcr.io/simonkurtz-msft/drawio-mcp-server:3.0.1 --help
docker run --rm --platform linux/arm64 ghcr.io/simonkurtz-msft/drawio-mcp-server:3.0.1 --help
```

---

## Performance expectations

The arm64 leg runs `deno compile` under QEMU user-mode emulation on an amd64 host (or vice-versa). Expect it to be **5–10× slower** than the native leg. On a typical dev laptop:

| Platform      | Approx. build time |
| ------------- | ------------------ |
| `linux/amd64` | ~45 s              |
| `linux/arm64` | ~5–7 min (QEMU)    |

If this becomes painful, switch to **native arm64 runners** in CI (GitHub Actions `ubuntu-24.04-arm`) and merge manifests with `docker buildx imagetools create`. The scripts in `scripts/` intentionally keep the simple single-host path; split builds are a CI optimization left to the workflow file.

---

## Windows containers

Native Windows containers (`windows/amd64`) are **not** covered by the default `Dockerfile` because:

- `gcr.io/distroless/cc-debian12` is Linux-only; there is no distroless equivalent for Windows.
- `deno compile` on Windows emits a `.exe` — the `ENTRYPOINT` path differs.
- Windows containers can only be built on a Windows host with Docker in Windows-container mode (not the default WSL2/Linux mode).

If you genuinely need a Windows-native image (e.g. a Windows Server host that cannot run Linux containers), create a sibling `Dockerfile.windows`:

```dockerfile
# escape=`
ARG DENO_VERSION=2.7.4
FROM denoland/deno:windows-${DENO_VERSION} AS builder
WORKDIR C:\app
COPY deno.json .\
COPY src\ .\src\
COPY assets\ .\assets\
RUN deno cache src/index.ts ; `
    deno compile `
      --allow-net --allow-read --allow-env `
      --include=src/instructions.md --include=assets/ `
      --output=drawio-mcp-server.exe src/index.ts

FROM mcr.microsoft.com/windows/nanoserver:ltsc2022
WORKDIR C:\app
COPY --from=builder C:\app\drawio-mcp-server.exe .\
EXPOSE 8080
ENV HTTP_PORT=8080 TRANSPORT=http LOGGER_TYPE=console
USER ContainerUser
ENTRYPOINT ["C:\\app\\drawio-mcp-server.exe"]
CMD ["--transport", "http", "--http-port", "8080"]
```

Build it separately (Docker Desktop → **Switch to Windows containers**):

```powershell
docker build -f Dockerfile.windows -t <registry>/drawio-mcp-server:3.0.1-windows .
```

Windows and Linux images **cannot** share a tag via a single `buildx --platform` invocation — they must be stitched together afterward with `docker manifest create`. Most teams skip this and publish `-windows` as a distinct tag suffix.

---

## Troubleshooting

| Symptom                                         | Fix                                                                                                                                                                                                                                          |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ERROR: Multi-platform build is not supported`  | You are on the default builder. The script exports `BUILDX_BUILDER=multiarch` — re-run it, or export the variable yourself before calling compose directly.                                                                                  |
| `required variable REGISTRY is missing a value` | `cp .env.example .env` and set `REGISTRY`. Compose reads `.env` automatically.                                                                                                                                                               |
| `exec /bin/sh: exec format error` during `RUN`  | Foreign-arch QEMU handler not registered **or** compose fell back to the default builder. The preflight fixes both automatically — re-run the script. If it recurs, `wsl --shutdown` wiped the kernel registration; the script re-registers. |
| `docker exporter does not currently support …`  | You ran `docker compose build` without `--push`. Either add `--push` or use `docker compose up --build`.                                                                                                                                     |
| arm64 binary segfaults at runtime               | Someone re-introduced `strip`. See the warning in the `Dockerfile` — Deno eszip payloads must not be stripped.                                                                                                                               |
| Push to GHCR fails with `unauthorized`          | `echo $CR_PAT                                                                                                                                                                                                                                |
