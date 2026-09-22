#!/usr/bin/env bash
# Build-only installation of release archives verified against the committed manifest; requires jq.
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
MANIFEST="${SCRIPT_DIR}/download-checksums.json"
ARCHITECTURE="$(dpkg --print-architecture)"

case "$ARCHITECTURE" in
    amd64) UV_TARGET="x86_64-unknown-linux-gnu" ;;
    arm64) UV_TARGET="aarch64-unknown-linux-gnu" ;;
    *) echo "Unsupported build architecture: ${ARCHITECTURE}; expected amd64 or arm64" >&2; exit 1 ;;
esac

WORK_DIR="$(mktemp -d)"
trap 'rm -rf -- "$WORK_DIR"' EXIT

for tool in uv gitleaks; do
    url="$(jq -er --arg tool "$tool" --arg arch "$ARCHITECTURE" '.[$tool].artifacts[$arch].url' "$MANIFEST")"
    checksum="$(jq -er --arg tool "$tool" --arg arch "$ARCHITECTURE" '.[$tool].artifacts[$arch].sha256' "$MANIFEST")"
    if [[ ! "$url" =~ ^https://github\.com/ || ! "$checksum" =~ ^[0-9a-f]{64}$ ]]; then
        echo "Invalid download manifest entry: ${tool}/${ARCHITECTURE}" >&2
        exit 1
    fi
    archive="${WORK_DIR}/${tool}.tar.gz"
    curl --fail --silent --show-error --location --retry 3 \
        --proto '=https' --proto-redir '=https' --tlsv1.2 \
        --output "$archive" "$url"
    printf '%s  %s\n' "$checksum" "$archive" | sha256sum --check --strict
    if [[ "$tool" == uv ]]; then
        tar --extract --gzip --file "$archive" --directory "$WORK_DIR" --no-same-owner \
            "uv-${UV_TARGET}/uv" "uv-${UV_TARGET}/uvx"
        install -m 0755 "${WORK_DIR}/uv-${UV_TARGET}/uv" /usr/local/bin/uv
        install -m 0755 "${WORK_DIR}/uv-${UV_TARGET}/uvx" /usr/local/bin/uvx
    else
        tar --extract --gzip --file "$archive" --directory "$WORK_DIR" --no-same-owner gitleaks
        install -m 0755 "${WORK_DIR}/gitleaks" /usr/local/bin/gitleaks
    fi
done
