#!/bin/bash
# Runs on every container start without installing or upgrading dependencies.

set -e

printf "\n Starting container...\n"

# Mounted workspaces can lose executable bits when core.fileMode=false.
if [ -d .github/hooks ]; then
    find .github/hooks -name '*.sh' -exec chmod +x {} +
    printf "    hook script perms     fixed\n"
fi

printf "    azd auth              "
if command -v azd >/dev/null 2>&1 && azd auth token --output json >/dev/null 2>&1; then
    printf "authenticated\n"
else
    printf "not authenticated - run 'azd auth login'\n"
fi

printf " Container ready\n\n"
