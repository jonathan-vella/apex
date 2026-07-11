#!/usr/bin/env bash
# Validate a built APEX dev container and emit a structured verdict for CI comparison.

# Deliberately omit `-e`: every check must run so the verdict captures all failures.
set -uo pipefail

usage() {
        printf '%s\n' \
                'Usage: validate-devcontainer.sh \' \
                '  --variant <baseline|candidate> \' \
                '  --expected-os <version> \' \
                '  --expected-arch <amd64|arm64> \' \
                '  --output-dir <workspace-relative-path>'
}

VARIANT=""
EXPECTED_OS=""
EXPECTED_ARCH=""
OUTPUT_DIR=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --variant)
            VARIANT="${2:-}"
            shift 2
            ;;
        --expected-os)
            EXPECTED_OS="${2:-}"
            shift 2
            ;;
        --expected-arch)
            EXPECTED_ARCH="${2:-}"
            shift 2
            ;;
        --output-dir)
            OUTPUT_DIR="${2:-}"
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            printf 'Unknown option: %s\n' "$1" >&2
            usage >&2
            exit 2
            ;;
    esac
done

if [[ "$VARIANT" != "baseline" && "$VARIANT" != "candidate" ]]; then
    printf 'Invalid --variant: %s\n' "$VARIANT" >&2
    exit 2
fi
if [[ -z "$EXPECTED_OS" || -z "$EXPECTED_ARCH" || -z "$OUTPUT_DIR" ]]; then
    usage >&2
    exit 2
fi
if [[ "$EXPECTED_ARCH" != "amd64" && "$EXPECTED_ARCH" != "arm64" ]]; then
    printf 'Invalid --expected-arch: %s\n' "$EXPECTED_ARCH" >&2
    exit 2
fi

readonly VARIANT EXPECTED_OS EXPECTED_ARCH
readonly START_EPOCH="$(date +%s)"
readonly OUTPUT_DIR
readonly CHECK_LOG_DIR="${OUTPUT_DIR}/checks"
readonly CHECKS_TSV="${OUTPUT_DIR}/checks.tsv"
readonly WARNINGS_FILE="${OUTPUT_DIR}/warnings.txt"
readonly VERDICT_FILE="${OUTPUT_DIR}/verdict.json"
readonly INSTALL_LOG="${HOME}/.devcontainer-install.log"
readonly WORK_DIR="$(mktemp -d)"

cleanup() {
    rm -rf "$WORK_DIR"
}
trap cleanup EXIT

mkdir -p "$CHECK_LOG_DIR"
: > "$CHECKS_TSV"
: > "$WARNINGS_FILE"

sanitize_message() {
    tr '\t\r\n' '   ' | sed -E 's/[[:space:]]+/ /g; s/^ //; s/ $//' | cut -c1-500
}

record_check() {
    local name="$1"
    local status="$2"
    local category="$3"
    local message="$4"
    printf '%s\t%s\t%s\t%s\n' "$name" "$status" "$category" "$message" >> "$CHECKS_TSV"
}

run_check() {
    local name="$1"
    local category="$2"
    shift 2

    local safe_name
    safe_name=$(printf '%s' "$name" | tr -c '[:alnum:]_-' '-')
    local log_file="${CHECK_LOG_DIR}/${safe_name}.log"
    local status="PASS"

    printf '→ %s\n' "$name"
    if "$@" > "$log_file" 2>&1; then
        printf '  ✅ PASS\n'
    else
        status="FAIL"
        printf '  ❌ FAIL (see %s)\n' "$log_file"
    fi

    local message
    message=$(tail -5 "$log_file" 2>/dev/null | sanitize_message)
    record_check "$name" "$status" "$category" "${message:-no output}"
}

check_expected_os() {
    [[ "$OBSERVED_OS" == "$EXPECTED_OS" ]]
}

check_expected_arch() {
    [[ "$OBSERVED_ARCH" == "$EXPECTED_ARCH" ]]
}

check_post_create_log() {
    if [[ ! -f "$INSTALL_LOG" ]]; then
        printf 'Missing %s\n' "$INSTALL_LOG"
        return 1
    fi

    cp "$INSTALL_LOG" "${OUTPUT_DIR}/post-create.log"
    grep -E '^[[:space:]]*⚠️[[:space:]].* \([0-9]+s\)$' "$INSTALL_LOG" \
        | sed -E 's/^[[:space:]]*⚠️[[:space:]]+//; s/ \([0-9]+s\)$//' \
        | sort -u > "$WARNINGS_FILE" || true

    local summary
    summary=$(grep -E 'Setup complete(!| with warnings:| with errors:)' "$INSTALL_LOG" | tail -1 || true)
    if [[ -z "$summary" ]]; then
        printf 'Setup summary not found\n'
        return 1
    fi
    printf '%s\n' "$summary"
    [[ "$summary" != *"with errors"* ]]
}

check_terraform_mcp() {
    if command -v terraform-mcp-server >/dev/null 2>&1; then
        terraform-mcp-server --version
    elif [[ -x /go/bin/terraform-mcp-server ]]; then
        /go/bin/terraform-mcp-server --version
    else
        printf 'terraform-mcp-server not found\n'
        return 1
    fi
}

prepare_test_dependencies() {
    npm ci
    npm ci --prefix site
    uv pip install --system --quiet \
        -e "${PWD}/tools/apex-recall" \
        -e "${PWD}/tools/mcp-servers/azure-pricing[dev]"
}

check_bicep_compile() {
    local source_file="${WORK_DIR}/smoke.bicep"
    local output_file="${WORK_DIR}/smoke.json"
    printf '%s\n' \
        "metadata description = 'APEX dev container validation'" \
        "param name string = 'smoke'" \
        "output result string = name" > "$source_file"
    az bicep build --file "$source_file" --outfile "$output_file"
    [[ -s "$output_file" ]]
}

check_terraform_validate() {
    local terraform_dir="${WORK_DIR}/terraform"
    mkdir -p "$terraform_dir"
    printf '%s\n' \
        'terraform {' \
        '  required_providers {' \
        '    azurerm = {' \
        '      source  = "hashicorp/azurerm"' \
        '      version = "~> 4.0"' \
        '    }' \
        '  }' \
        '}' \
        '' \
        'provider "azurerm" {' \
        '  features {}' \
        '  skip_provider_registration = true' \
        '}' > "${terraform_dir}/main.tf"
    terraform -chdir="$terraform_dir" init -backend=false -input=false
    terraform -chdir="$terraform_dir" validate
}

check_diagram_render() {
    local script_file="${WORK_DIR}/render.py"
    local output_base="${WORK_DIR}/apex-devcontainer"
    printf '%s\n' \
        'import sys' \
        'from pathlib import Path' \
        'from diagrams import Diagram' \
        'from diagrams.azure.compute import VM' \
        '' \
        'output_base = sys.argv[1]' \
        'with Diagram("APEX validation", filename=output_base, show=False, outformat="png"):' \
        '    VM("smoke")' \
        'output = Path(f"{output_base}.png")' \
        'if not output.is_file() or output.stat().st_size < 1024:' \
        '    raise SystemExit("diagram PNG was not rendered")' > "$script_file"
    python3 "$script_file" "$output_base"
}

# Environment metadata and invariants.
OBSERVED_OS=$(source /etc/os-release && printf '%s' "$VERSION_ID")
OBSERVED_ARCH=$(dpkg --print-architecture)
GLIBC_VERSION=$(ldd --version 2>&1 | head -1 | sanitize_message)
OPENSSL_VERSION=$(openssl version 2>&1 | sanitize_message)

run_check "expected-ubuntu-version" "compatibility" check_expected_os
run_check "expected-architecture" "compatibility" check_expected_arch
run_check "post-create-summary" "compatibility" check_post_create_log
run_check "post-start-idempotency" "compatibility" bash .devcontainer/post-start.sh
run_check "test-dependency-setup" "network" prepare_test_dependencies

# Tool availability and basic execution.
run_check "azure-cli" "compatibility" az version --output json
run_check "bicep-cli" "compatibility" az bicep version
run_check "powershell" "compatibility" pwsh --version
run_check "python-3.14" "compatibility" python3 -c \
    'import sys; assert sys.version_info[:2] == (3, 14), sys.version'
run_check "node" "compatibility" node --version
run_check "github-cli" "compatibility" gh --version
run_check "uv" "compatibility" uv --version
run_check "checkov" "compatibility" checkov --version
run_check "markdownlint-cli2" "compatibility" markdownlint-cli2 --version
run_check "graphviz" "compatibility" dot -V
run_check "dos2unix" "compatibility" dos2unix --version
run_check "k6" "compatibility" k6 version
run_check "deno" "compatibility" deno --version
run_check "gitleaks" "compatibility" gitleaks version
run_check "terraform" "compatibility" terraform version
run_check "tflint" "compatibility" tflint --version
run_check "azd" "compatibility" azd version
run_check "ruff" "compatibility" ruff --version
run_check "apex-recall" "compatibility" apex-recall --version
run_check "terraform-mcp-server" "compatibility" check_terraform_mcp
run_check "python-package-imports" "compatibility" python3 -c \
    'import diagrams, matplotlib, PIL, checkov; from azure_pricing_mcp import server'

# Existing repository validation gates.
run_check "format-check" "harness" npm run format:check
run_check "hook-tests" "harness" npm run test:hooks
run_check "validate-all" "harness" npm run validate:all

# Functional checks specific to the container runtime and public integrations.
run_check "bicep-compile" "compatibility" check_bicep_compile
run_check "terraform-init-validate" "network" check_terraform_validate
run_check "azure-pricing-live-integration" "network" python3 -m pytest \
    tools/mcp-servers/azure-pricing/tests/test_integration.py::test_real_vm_price_search \
    tools/mcp-servers/azure-pricing/tests/test_integration.py::test_real_storage_price_search \
    -q -o "addopts="
run_check "diagram-render" "compatibility" check_diagram_render

END_EPOCH=$(date +%s)
readonly END_EPOCH

node -e '
const fs = require("node:fs");
const [output, checksFile, warningsFile, variant, expectedOs, observedOs, expectedArch, observedArch, glibc, openssl, started, ended] = process.argv.slice(1);
const parseLines = (file) => fs.readFileSync(file, "utf8").split("\n").filter(Boolean);
const checks = parseLines(checksFile).map((line) => {
  const [name, status, category, ...message] = line.split("\t");
  return { name, status, category, message: message.join("\t") };
});
const warnings = parseLines(warningsFile);
const failures = checks.filter((check) => check.status !== "PASS");
const verdict = {
  schema_version: 1,
  generated_at: new Date().toISOString(),
  variant,
  expected_os: expectedOs,
  observed_os: observedOs,
  expected_arch: expectedArch,
  observed_arch: observedArch,
  status: failures.length === 0 ? "PASS" : "FAIL",
  warnings,
  failure_categories: [...new Set(failures.map((check) => check.category))].sort(),
  checks,
  environment: {
    glibc,
    openssl,
    elapsed_seconds: Number(ended) - Number(started),
  },
};
fs.writeFileSync(output, `${JSON.stringify(verdict, null, 2)}\n`);
' "$VERDICT_FILE" "$CHECKS_TSV" "$WARNINGS_FILE" "$VARIANT" "$EXPECTED_OS" "$OBSERVED_OS" \
    "$EXPECTED_ARCH" "$OBSERVED_ARCH" "$GLIBC_VERSION" "$OPENSSL_VERSION" "$START_EPOCH" "$END_EPOCH"

FAILED_COUNT=$(awk -F '\t' '$2 != "PASS" { count += 1 } END { print count + 0 }' "$CHECKS_TSV")
printf '\nVerdict: %s (%s failed checks)\n' "$([[ "$FAILED_COUNT" -eq 0 ]] && printf PASS || printf FAIL)" "$FAILED_COUNT"
printf 'Result: %s\n' "$VERDICT_FILE"

[[ "$FAILED_COUNT" -eq 0 ]]
