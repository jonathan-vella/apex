#!/usr/bin/env bash
# Install the pinned azqr release verified against download-checksums.json; requires jq and unzip.
# azqr is optional: Azure MCP lists extension_azqr only when azqr 3.0.0 or later is on PATH.
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
MANIFEST="${SCRIPT_DIR}/download-checksums.json"
INSTALL_DIR="${AZQR_INSTALL_DIR:-${HOME}/.local/bin}"
MACHINE="$(uname -m)"

case "$MACHINE" in
    x86_64) ARCHITECTURE="amd64" ;;
    aarch64 | arm64) ARCHITECTURE="arm64" ;;
    *) echo "Unsupported architecture: ${MACHINE}; expected x86_64 or aarch64" >&2; exit 1 ;;
esac

version="$(jq -er '.azqr.version' "$MANIFEST")"
if command -v azqr >/dev/null 2>&1 && azqr --version 2>&1 | grep -qF "$version"; then
    echo "azqr ${version} already installed"
    exit 0
fi

url="$(jq -er --arg arch "$ARCHITECTURE" '.azqr.artifacts[$arch].url' "$MANIFEST")"
checksum="$(jq -er --arg arch "$ARCHITECTURE" '.azqr.artifacts[$arch].sha256' "$MANIFEST")"
if [[ ! "$url" =~ ^https://github\.com/Azure/azqr/ || ! "$checksum" =~ ^[0-9a-f]{64}$ ]]; then
    echo "Invalid download manifest entry: azqr/${ARCHITECTURE}" >&2
    exit 1
fi

WORK_DIR="$(mktemp -d)"
trap 'rm -rf -- "$WORK_DIR"' EXIT

archive="${WORK_DIR}/azqr.zip"
curl --fail --silent --show-error --location --retry 3 \
    --proto '=https' --proto-redir '=https' --tlsv1.2 \
    --output "$archive" "$url"
printf '%s  %s\n' "$checksum" "$archive" | sha256sum --check --strict
unzip -q -o "$archive" -d "${WORK_DIR}/extract"

# The archive nests the binary under bin/linux_<arch>/.
binary="$(find "${WORK_DIR}/extract" -type f -name azqr | head -n 1)"
if [[ -z "$binary" ]]; then
    echo "azqr binary not found in the downloaded archive" >&2
    exit 1
fi
mkdir -p "$INSTALL_DIR"
install -m 0755 "$binary" "${INSTALL_DIR}/azqr"
echo "Installed azqr ${version} to ${INSTALL_DIR}/azqr"
