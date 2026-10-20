#!/usr/bin/env bash
# The upstream Azure CLI feature requires dpkg even on its pip installation path.
set -euo pipefail

if [[ ! "${VERSION:-}" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ || ! "${PIPVERSION:-}" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "Azure CLI and pip require exact stable version options." >&2
    exit 1
fi

uv venv --python /usr/local/python/current/bin/python3 /opt/azure-cli
uv pip install --python /opt/azure-cli/bin/python "azure-cli==${VERSION}" "pip==${PIPVERSION}"
ln -s /opt/azure-cli/bin/az /usr/local/bin/az
az version --output none
