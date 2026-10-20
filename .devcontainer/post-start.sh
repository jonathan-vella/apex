#!/bin/bash
# Runs on every container start without installing or upgrading dependencies.

set -e

printf "\n Starting container...\n"

# Labels only: a custom registry URL can carry credentials, so it is never printed.
package_source_kind() {
    case "$1" in
        "") printf 'unset' ;;
        https://packagefeedproxy.microsoft.io/*) printf 'Microsoft CFS' ;;
        "https://$2/"*) printf 'public' ;;
        *) printf 'custom' ;;
    esac
}
npm_source=$(package_source_kind "${NPM_CONFIG_REGISTRY:-}" registry.npmjs.org)
pip_source=$(package_source_kind "${PIP_INDEX_URL:-}" pypi.org)
uv_source=$(package_source_kind "${UV_INDEX_URL:-}" pypi.org)
printf "    package sources       npm: %s, pip: %s, uv: %s\n" "$npm_source" "$pip_source" "$uv_source"
if [[ "$npm_source$pip_source$uv_source" != *"Microsoft CFS"* ]]; then
    printf "    Microsoft maintainers: opt in to CFS (see README Package Sources).\n"
elif [[ "$npm_source" != "Microsoft CFS" || "$pip_source" != "Microsoft CFS" || "$uv_source" != "Microsoft CFS" ]]; then
    printf "    WARNING: CFS opt-in is incomplete; set both APEX_NPM_REGISTRY_HOST_PATH and APEX_PIP_INDEX_HOST_PATH.\n"
fi

printf "    Azure MCP release     checking stable release (30s registry timeout)\n"
if command -v npm >/dev/null 2>&1; then
    if release_status=$(npm run --silent check:mcp-release 2>&1); then
        printf '    Azure MCP release     current\n%s\n' "$release_status"
    else
        printf '    WARNING: Azure MCP release is outdated or could not be verified.\n%s\n' "$release_status"
        printf "    Review the result before APEX; retry with 'npm run check:mcp-release'.\n"
    fi
else
    printf "    WARNING: npm unavailable; run 'npm run check:mcp-release' after setup completes.\n"
fi

printf "    azd auth              "
if command -v azd >/dev/null 2>&1 && azd auth token --output json >/dev/null 2>&1; then
    printf "authenticated\n"
else
    printf "not authenticated - run 'azd auth login'\n"
fi

# An interactive rm/mv/cp alias can hang an agent terminal waiting for a prompt it never gets.
# post-start.sh itself is non-interactive, so .bashrc's aliases must be probed via -i.
interactive_aliases=""
for name in rm mv cp; do
    if bash -i -c "alias $name" 2>/dev/null | grep -qE -- '-[a-zA-Z]*i[a-zA-Z]*'; then
        interactive_aliases="$interactive_aliases $name"
    fi
done
if [ -n "$interactive_aliases" ]; then
    printf "    WARNING: interactive shell alias(es) found:%s\n" "$interactive_aliases"
    printf "    Agent terminals inherit these; drop the -i flag (see dotfiles shell/.bashrc).\n"
fi

printf " Container ready\n\n"
