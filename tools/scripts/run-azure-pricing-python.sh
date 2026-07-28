#!/usr/bin/env bash
# Run Azure Pricing Python tooling in its component environment when available,
# while retaining the CI-installed system Python fallback.
set -euo pipefail

readonly REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
readonly COMPONENT_DIR="${REPO_ROOT}/tools/mcp-servers/azure-pricing"
readonly COMPONENT_PYTHON="${COMPONENT_DIR}/.venv/bin/python"

if [[ -x "${COMPONENT_PYTHON}" ]]; then
  PYTHON="${COMPONENT_PYTHON}"
else
  PYTHON="$(command -v python3)"
fi

cd "${COMPONENT_DIR}"
exec "${PYTHON}" "$@"
