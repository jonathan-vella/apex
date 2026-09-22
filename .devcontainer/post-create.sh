#!/usr/bin/env bash
# Install workspace dependencies after build-time tools and persistent mounts are ready.
set -euo pipefail

exec > >(tee "${HOME}/.devcontainer-install.log") 2>&1
trap 'printf "Setup failed at line %s; resolve the error and rerun post-create.sh.\n" "$LINENO" >&2' ERR
export PATH="${HOME}/.local/bin:${PWD}/node_modules/.bin:${PATH}"

printf "Preparing mounted cache directories...\n"
for directory in "${HOME}/.cache/uv" "${HOME}/.config/gh" "${TF_PLUGIN_CACHE_DIR:-${HOME}/.terraform.d/plugin-cache}"; do
    if [[ ! -d "$directory" || ! -w "$directory" ]]; then
        sudo -n mkdir -p "$directory"
        sudo -n chown "$(id -u):$(id -g)" "$directory"
    fi
done

printf "Installing workspace Node dependencies...\n"
if [[ "$(npm --version)" != "12.0.2" ]]; then
    npm install --global npm@12.0.2
fi
npm ci --loglevel=error

printf "Installing Python requirements and editable recall package...\n"
uv pip install --system --quiet --requirement "${PWD}/requirements.txt" --editable "${PWD}/tools/apex-recall"
python3 -c "import diagrams, matplotlib, PIL, pytest, ruff, apex_recall"
apex-recall --version

printf "Installing required Azure PowerShell modules...\n"
pwsh -NoProfile -NonInteractive -Command '
    $ErrorActionPreference = "Stop"
    try {
        $modules = @("Az.Accounts", "Az.Resources", "Az.Storage", "Az.Network", "Az.KeyVault", "Az.Websites")
        foreach ($module in $modules) {
            if (-not (Get-Module -ListAvailable -Name $module)) {
                Install-Module -Name $module -Repository PSGallery -Scope CurrentUser -Force -AllowClobber -ErrorAction Stop
            }
            if (-not (Get-Module -ListAvailable -Name $module)) {
                throw "Required module unavailable: $module"
            }
        }
    } catch {
        Write-Error $_ -ErrorAction Continue
        exit 1
    }
'

printf "Verifying build tools and CLI configuration...\n"
gitleaks version
uv --version
terraform version
az config set extension.use_dynamic_install=yes_without_prompt extension.dynamic_install_allow_preview=false auto-upgrade.enable=no --only-show-errors
if command -v bicep >/dev/null 2>&1; then
    bicep --version
elif ! az bicep version --only-show-errors; then
    az bicep install --only-show-errors
    az bicep version --only-show-errors
fi

printf "Adding only missing MCP defaults...\n"
node .devcontainer/configure-mcp.mjs
node tools/scripts/validate-tool-versions.mjs

printf "Authenticate explicitly when needed; existing Git credentials and configuration were not changed.\n"
printf "Setup complete.\n"
