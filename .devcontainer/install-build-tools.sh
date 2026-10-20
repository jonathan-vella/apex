#!/usr/bin/env bash
# Build-only installation of release archives verified against the committed manifest; requires jq.
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
MANIFEST="${SCRIPT_DIR}/download-checksums.json"
MACHINE="$(uname -m)"

case "$MACHINE" in
    x86_64) ARCHITECTURE="amd64"; UV_TARGET="x86_64-unknown-linux-gnu" ;;
    aarch64 | arm64) ARCHITECTURE="arm64"; UV_TARGET="aarch64-unknown-linux-gnu" ;;
    *) echo "Unsupported build architecture: ${MACHINE}; expected x86_64 or aarch64" >&2; exit 1 ;;
esac

WORK_DIR="$(mktemp -d)"
trap 'rm -rf -- "$WORK_DIR"' EXIT

tools=("$@")
if [[ ${#tools[@]} -eq 0 ]]; then
    tools=(uv gitleaks terraform gh bicep azd)
fi

for tool in "${tools[@]}"; do
    case "$tool" in
        uv | gitleaks | terraform | gh | bicep | azd) ;;
        *) echo "Unsupported build tool: ${tool}" >&2; exit 1 ;;
    esac
    version="$(jq -er --arg tool "$tool" '.[$tool].version' "$MANIFEST")"
    url="$(jq -er --arg tool "$tool" --arg arch "$ARCHITECTURE" '.[$tool].artifacts[$arch].url' "$MANIFEST")"
    checksum="$(jq -er --arg tool "$tool" --arg arch "$ARCHITECTURE" '.[$tool].artifacts[$arch].sha256' "$MANIFEST")"
    case "$tool" in
        uv) prefix="https://github.com/astral-sh/uv/releases/download/${version}/" ;;
        gitleaks) prefix="https://github.com/gitleaks/gitleaks/releases/download/v${version}/" ;;
        terraform) prefix="https://releases.hashicorp.com/terraform/${version}/" ;;
        gh) prefix="https://github.com/cli/cli/releases/download/v${version}/" ;;
        bicep) prefix="https://github.com/Azure/bicep/releases/download/v${version}/" ;;
        azd) prefix="https://github.com/Azure/azure-dev/releases/download/azure-dev-cli_${version}/" ;;
    esac
    if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ || "$url" != "$prefix"* || ! "$checksum" =~ ^[0-9a-f]{64}$ ]]; then
        echo "Invalid download manifest entry: ${tool}/${ARCHITECTURE}" >&2
        exit 1
    fi
    archive="${WORK_DIR}/${tool}.download"
    curl --fail --silent --show-error --location --retry 3 \
        --proto '=https' --proto-redir '=https' --tlsv1.2 \
        --output "$archive" "$url"
    printf '%s  %s\n' "$checksum" "$archive" | sha256sum --check --strict
    case "$tool" in
        uv)
            tar --extract --gzip --file "$archive" --directory "$WORK_DIR" --no-same-owner \
                "uv-${UV_TARGET}/uv" "uv-${UV_TARGET}/uvx"
            install -m 0755 "${WORK_DIR}/uv-${UV_TARGET}/uv" /usr/local/bin/uv
            install -m 0755 "${WORK_DIR}/uv-${UV_TARGET}/uvx" /usr/local/bin/uvx
            ;;
        gitleaks)
            tar --extract --gzip --file "$archive" --directory "$WORK_DIR" --no-same-owner gitleaks
            install -m 0755 "${WORK_DIR}/gitleaks" /usr/local/bin/gitleaks
            ;;
        terraform)
            unzip -q "$archive" terraform -d "$WORK_DIR"
            install -m 0755 "${WORK_DIR}/terraform" /usr/local/bin/terraform
            ;;
        gh)
            member="gh_${version}_linux_${ARCHITECTURE}/bin/gh"
            tar --extract --gzip --file "$archive" --directory "$WORK_DIR" --no-same-owner "$member"
            install -m 0755 "${WORK_DIR}/${member}" /usr/local/bin/gh
            ;;
        bicep)
            install -m 0755 "$archive" /usr/local/bin/bicep
            ;;
        azd)
            member="azd-linux-${ARCHITECTURE}"
            tar --extract --gzip --file "$archive" --directory "$WORK_DIR" --no-same-owner "$member"
            install -m 0755 "${WORK_DIR}/${member}" /usr/local/bin/azd
            ;;
    esac
done
