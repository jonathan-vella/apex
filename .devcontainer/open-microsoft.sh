#!/usr/bin/env bash
# Launch a fresh host VS Code process with Microsoft package-feed opt-ins.
set -euo pipefail

if ! command -v code >/dev/null 2>&1; then
    printf 'VS Code CLI is required; enable the code command on your host PATH first.\n' >&2
    exit 127
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
export APEX_NPM_REGISTRY_HOST_PATH=packagefeedproxy.microsoft.io/npm/
export APEX_PIP_INDEX_HOST_PATH=packagefeedproxy.microsoft.io/pypi/simple/
export APEX_POWERSHELL_REPOSITORY_URL=https://packagefeedproxy.microsoft.io/powershell/v2

if [[ -n "${WSL_DISTRO_NAME:-}" ]]; then
    # The Windows VS Code process must inherit the opt-ins when launched from WSL.
    IFS=: read -r -a entries <<< "${WSLENV:-}"
    forwarded=""
    for entry in "${entries[@]}"; do
        case "${entry%%/*}" in
            APEX_NPM_REGISTRY_HOST_PATH | APEX_PIP_INDEX_HOST_PATH | APEX_POWERSHELL_REPOSITORY_URL | "") ;;
            *) forwarded="${forwarded}${entry}:" ;;
        esac
    done
    export WSLENV="${forwarded}APEX_NPM_REGISTRY_HOST_PATH:APEX_PIP_INDEX_HOST_PATH:APEX_POWERSHELL_REPOSITORY_URL"
fi

printf 'Opening VS Code with Microsoft CFS sources for image builds and container setup.\n'
printf 'All existing VS Code windows must be closed first; an existing process retains its old environment.\n'
exec code "${SCRIPT_DIR}/.."
