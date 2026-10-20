#!/usr/bin/env bash
# Validate a built APEX dev container and emit a structured verdict for CI comparison.

# Deliberately omit `-e`: every check must run so the verdict captures all failures.
set -uo pipefail

usage() {
        printf '%s\n' \
                'Usage: validate-devcontainer.sh \' \
                '  --variant <baseline|candidate> \' \
                '  --expected-distro-id <ID> \' \
                '  --expected-os <version> \' \
                '  --expected-arch <amd64|arm64> \' \
                '  --output-dir <fresh-directory> \' \
                '  [--workspace-root <path>] \' \
                '  [--expected-python-version <version>] [--expected-node-version <version>]' \
                'Run once per native container; only CI compares the complete baseline/candidate matrix.'
}

VALIDATION_VARIANT=""
EXPECTED_DISTRO_ID=""
EXPECTED_OS=""
EXPECTED_ARCH=""
EXPECTED_PYTHON=""
EXPECTED_NODE=""
WORKSPACE_ROOT="$PWD"
OUTPUT_DIR=""

while [[ $# -gt 0 ]]; do
    if [[ "$1" != "-h" && "$1" != "--help" && ( $# -lt 2 || "$2" == --* || -z "$2" ) ]]; then
        printf 'Missing value for %s\n' "$1" >&2
        exit 2
    fi
    case "$1" in
        --variant)
            VALIDATION_VARIANT="${2:-}"
            shift 2
            ;;
        --expected-distro-id)
            EXPECTED_DISTRO_ID="$2"
            shift 2
            ;;
        --expected-os)
            EXPECTED_OS="${2:-}"
            shift 2
            ;;
        --workspace-root)
            WORKSPACE_ROOT="$2"
            shift 2
            ;;
        --expected-python-version)
            EXPECTED_PYTHON="$2"
            shift 2
            ;;
        --expected-node-version)
            EXPECTED_NODE="$2"
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

if [[ "$VALIDATION_VARIANT" != "baseline" && "$VALIDATION_VARIANT" != "candidate" ]]; then
    printf 'Invalid --variant: %s\n' "$VALIDATION_VARIANT" >&2
    exit 2
fi
if [[ -z "$EXPECTED_DISTRO_ID" || -z "$EXPECTED_OS" || -z "$EXPECTED_ARCH" || -z "$OUTPUT_DIR" ]]; then
    usage >&2
    exit 2
fi
if [[ "$EXPECTED_ARCH" != "amd64" && "$EXPECTED_ARCH" != "arm64" ]]; then
    printf 'Invalid --expected-arch: %s\n' "$EXPECTED_ARCH" >&2
    exit 2
fi

readonly EVALUATOR_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]:-$0}")" && pwd)"

if ! cd -- "$WORKSPACE_ROOT" || [[ ! -f package.json || ! -f .devcontainer/devcontainer.json ]]; then
    printf 'Invalid --workspace-root: %s\n' "$WORKSPACE_ROOT" >&2
    exit 2
fi
WORKSPACE_ROOT="$PWD"
if [[ "$OUTPUT_DIR" != /* ]]; then OUTPUT_DIR="${WORKSPACE_ROOT}/${OUTPUT_DIR}"; fi
if ! mkdir -p -- "$(dirname -- "$OUTPUT_DIR")" || ! mkdir -- "$OUTPUT_DIR"; then
    printf 'Output directory must be new (existing evidence is never reused): %s\n' "$OUTPUT_DIR" >&2
    exit 2
fi

readonly VALIDATION_VARIANT EXPECTED_DISTRO_ID EXPECTED_OS EXPECTED_ARCH EXPECTED_PYTHON EXPECTED_NODE WORKSPACE_ROOT
readonly START_EPOCH="$(date +%s)"
readonly OUTPUT_DIR
readonly CHECK_LOG_DIR="${OUTPUT_DIR}/checks"
readonly CHECKS_TSV="${OUTPUT_DIR}/checks.tsv"
readonly WARNINGS_FILE="${OUTPUT_DIR}/warnings.txt"
readonly VERDICT_FILE="${OUTPUT_DIR}/verdict.json"
readonly INSTALL_LOG="${HOME}/.devcontainer-install.log"
readonly WORK_DIR="${OUTPUT_DIR}/.work"

cleanup() {
    rm -rf -- "$WORK_DIR"
}
trap cleanup EXIT

mkdir -p "$CHECK_LOG_DIR" "$WORK_DIR"
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

check_expected_distro() {
    [[ "$OBSERVED_DISTRO_ID" == "$EXPECTED_DISTRO_ID" ]]
}

normalize_arch() {
    case "$1" in
        x86_64|amd64) printf amd64 ;;
        aarch64|arm64) printf arm64 ;;
        *) printf '%s' "$1"; return 1 ;;
    esac
}

check_expected_arch() {
    [[ "$OBSERVED_ARCH" == "$EXPECTED_ARCH" ]]
}

check_azure_cli_extension() {
    local wheel="${WORK_DIR}/apex_ci_probe-0.0.0-py3-none-any.whl"
    python3 -c '
import sys
from zipfile import ZipFile

with ZipFile(sys.argv[1], "w") as wheel:
    wheel.writestr("azext_apex_ci_probe/__init__.py", "")
    wheel.writestr("azext_apex_ci_probe/azext_metadata.json", "{}")
    wheel.writestr("apex_ci_probe-0.0.0.dist-info/METADATA",
                   "Metadata-Version: 2.1\nName: apex-ci-probe\nVersion: 0.0.0\n")
    wheel.writestr("apex_ci_probe-0.0.0.dist-info/WHEEL",
                   "Wheel-Version: 1.0\nRoot-Is-Purelib: true\nTag: py3-none-any\n")
    wheel.writestr("apex_ci_probe-0.0.0.dist-info/RECORD", "")
' "$wheel" || return
    (
        export AZURE_CONFIG_DIR="${WORK_DIR}/azure-config"
        export AZURE_EXTENSION_DIR="${WORK_DIR}/azure-extensions"
        export PIP_NO_INDEX=1 PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
        export AZURE_CORE_COLLECT_TELEMETRY=no AZURE_CORE_CHECK_LATEST_VERSION=no
        az extension add --source "$wheel" --yes --only-show-errors || exit
        local version
        version=$(az extension show --name apex-ci-probe --query version --output tsv) || exit
        [[ "$version" == "0.0.0" ]]
    )
}

check_post_create_log() {
    if [[ ! -f "$INSTALL_LOG" ]]; then
        printf 'Missing %s\n' "$INSTALL_LOG"
        return 1
    fi

    cp "$INSTALL_LOG" "${OUTPUT_DIR}/post-create.log" || return 1
    grep -E '^[[:space:]]*⚠️[[:space:]].* \([0-9]+s\)$' "$INSTALL_LOG" \
        | sed -E 's/^[[:space:]]*⚠️[[:space:]]+//; s/ \([0-9]+s\)$//' \
        | sort -u > "$WARNINGS_FILE" || true

    local summary
    summary=$(grep -E '^Setup complete(\.|!| with (warnings|errors): [0-9]+)$' "$INSTALL_LOG" | tail -1 || true)
    if [[ -z "$summary" ]]; then
        printf 'Setup summary not found\n'
        return 1
    fi
    printf '%s\n' "$summary"
    if [[ "$summary" =~ with\ warnings:\ [1-9][0-9]*$ && ! -s "$WARNINGS_FILE" ]]; then
        printf 'post-create reported warnings without detailed warning records\n' >> "$WARNINGS_FILE"
    fi
    [[ "$summary" != *"with errors"* ]]
}

prepare_test_dependencies() {
    npm ci || return
    if [[ -f site/package.json ]]; then npm ci --prefix site || return; fi
    uv pip install --python "$(command -v python3)" --quiet -e "${PWD}/tools/apex-recall"
}

check_runtime_contract() {
    node "${EVALUATOR_DIR}/compare-devcontainer-verdicts.mjs" --runtime-contract \
        "$WORKSPACE_ROOT" "$VALIDATION_VARIANT" "$EXPECTED_PYTHON" "$EXPECTED_NODE" > "${WORK_DIR}/runtime-contract.json"
}

check_python_version() {
    python3 -c '
import json, sys
with open(sys.argv[1]) as source:
    contract = json.load(source)["python"]
expected = tuple(map(int, contract["version"].split(".")))
actual = sys.version_info[:len(expected)]
print(sys.version)
assert actual >= expected if contract["mode"] == "minimum" else actual == expected, contract
' "${WORK_DIR}/runtime-contract.json"
}

check_node_version() {
    node --input-type=module -e '
import fs from "node:fs";
import { pathToFileURL } from "node:url";
const { matchesRuntimeVersion } = await import(pathToFileURL(process.argv[2]).href);
const contract = JSON.parse(fs.readFileSync(process.argv[1], "utf8")).node;
console.log(process.version);
if (!matchesRuntimeVersion(process.versions.node, contract.version, contract.mode)) process.exit(1);
' "${WORK_DIR}/runtime-contract.json" "${EVALUATOR_DIR}/compare-devcontainer-verdicts.mjs"
}

check_tool_versions() {
    node "${EVALUATOR_DIR}/compare-devcontainer-verdicts.mjs" --tool-version-contracts \
        "$WORKSPACE_ROOT" "$CHECK_LOG_DIR" > "${WORK_DIR}/tool-versions.json"
    local status=$?
    cat "${WORK_DIR}/tool-versions.json"
    return "$status"
}

check_optional_azqr() {
    if command -v azqr >/dev/null 2>&1; then
        run_check "azqr" "compatibility" azqr --version
    else
        local warning="optional azqr unavailable"
        printf '%s\n' "$warning" >> "$WARNINGS_FILE"
        printf '%s\n' "$warning" > "${CHECK_LOG_DIR}/azqr.log"
        record_check "azqr" "WARN" "compatibility" "$warning"
    fi
}

check_bicep_compile() {
    local source_file="${WORK_DIR}/smoke.bicep"
    local output_file="${WORK_DIR}/smoke.json"
    printf '%s\n' \
        "metadata description = 'APEX dev container validation'" \
        "param name string = 'smoke'" \
        "output result string = name" > "$source_file"
    if command -v bicep >/dev/null 2>&1; then
        bicep build "$source_file" --outfile "$output_file"
    else
        az bicep build --file "$source_file" --outfile "$output_file"
    fi
    [[ -s "$output_file" ]]
}

check_bicep_cli() {
    if command -v bicep >/dev/null 2>&1; then
        bicep --version
    else
        az bicep version
    fi
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
OBSERVED_DISTRO_ID=$(source /etc/os-release && printf '%s' "$ID")
OBSERVED_ARCH=$(normalize_arch "$(uname -m)")
GLIBC_VERSION=$(ldd --version 2>&1 | head -1 | sanitize_message)
OPENSSL_VERSION=$(openssl version 2>&1 | sanitize_message)

run_check "expected-distro-id" "compatibility" check_expected_distro
run_check "expected-os-version" "compatibility" check_expected_os
run_check "expected-architecture" "compatibility" check_expected_arch
run_check "nonroot-user" "compatibility" test "$(id -u)" -ne 0
run_check "passwordless-sudo" "compatibility" sudo -n true
run_check "post-create-summary" "compatibility" check_post_create_log
run_check "post-start-idempotency" "compatibility" bash .devcontainer/post-start.sh
run_check "test-dependency-setup" "network" prepare_test_dependencies
run_check "runtime-version-contract" "compatibility" check_runtime_contract

# Tool availability and basic execution.
run_check "azure-cli" "compatibility" az version --output json
run_check "azure-cli-extensions" "compatibility" check_azure_cli_extension
run_check "bicep-cli" "compatibility" check_bicep_cli
run_check "powershell" "compatibility" pwsh --version
run_check "powershell-analyzer" "compatibility" pwsh -NoLogo -NoProfile -NonInteractive -Command \
    '$ErrorActionPreference = "Stop"; Import-Module PSScriptAnalyzer -ErrorAction Stop; Get-Command Invoke-ScriptAnalyzer -Module PSScriptAnalyzer -ErrorAction Stop | Out-Null'
run_check "python-version" "compatibility" check_python_version
run_check "node-version" "compatibility" check_node_version
run_check "npm-version" "compatibility" npm --version
run_check "github-cli" "compatibility" gh --version
run_check "uv" "compatibility" uv --version
run_check "markdownlint-cli2" "compatibility" npx --no-install markdownlint-cli2 --version
run_check "graphviz" "compatibility" dot -V
run_check "gitleaks" "compatibility" gitleaks version
run_check "terraform" "compatibility" terraform version
run_check "azd" "compatibility" azd version
check_optional_azqr
run_check "ruff" "compatibility" ruff --version
run_check "apex-recall" "compatibility" apex-recall --version
run_check "python-package-imports" "compatibility" python3 -c \
    'import diagrams, matplotlib, PIL, pytest, ruff'
run_check "tool-version-contracts" "compatibility" check_tool_versions

# Existing repository validation gates.
run_check "format-check" "harness" npm run format:check
run_check "git-hook-tests" "harness" npm run test:git-hooks
run_check "validate-all" "harness" npm run validate:all

# Functional checks specific to the container runtime and public integrations.
run_check "bicep-compile" "compatibility" check_bicep_compile
run_check "terraform-init-validate" "network" check_terraform_validate
run_check "diagram-render" "compatibility" check_diagram_render

END_EPOCH=$(date +%s)
readonly END_EPOCH

node -e '
const fs = require("node:fs");
const [output, checksFile, warningsFile, variant, expectedDistro, observedDistro, expectedOs, observedOs, expectedArch, observedArch, glibc, openssl, started, ended, versionsFile] = process.argv.slice(1);
const parseLines = (file) => fs.readFileSync(file, "utf8").split("\n").filter(Boolean);
const checks = parseLines(checksFile).map((line) => {
  const [name, status, category, ...message] = line.split("\t");
  return { name, status, category, message: message.join("\t") };
});
const warnings = parseLines(warningsFile);
const failures = checks.filter((check) => check.status === "FAIL");
let toolVersions = { status: "FAIL", checks: [], unpinned: [], error: "Version evidence unavailable" };
try { toolVersions = JSON.parse(fs.readFileSync(versionsFile, "utf8")); } catch {}
const verdict = {
  schema_version: 1,
  generated_at: new Date().toISOString(),
  variant,
  expected_distro_id: expectedDistro,
  observed_distro_id: observedDistro,
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
    tool_versions: toolVersions,
  },
};
fs.writeFileSync(output, `${JSON.stringify(verdict, null, 2)}\n`);
' "$VERDICT_FILE" "$CHECKS_TSV" "$WARNINGS_FILE" "$VALIDATION_VARIANT" "$EXPECTED_DISTRO_ID" "$OBSERVED_DISTRO_ID" "$EXPECTED_OS" "$OBSERVED_OS" \
    "$EXPECTED_ARCH" "$OBSERVED_ARCH" "$GLIBC_VERSION" "$OPENSSL_VERSION" "$START_EPOCH" "$END_EPOCH" "${WORK_DIR}/tool-versions.json"

FAILED_COUNT=$(awk -F '\t' '$2 == "FAIL" { count += 1 } END { print count + 0 }' "$CHECKS_TSV")
printf '\nVerdict: %s (%s failed checks)\n' "$([[ "$FAILED_COUNT" -eq 0 ]] && printf PASS || printf FAIL)" "$FAILED_COUNT"
printf 'Result: %s\n' "$VERDICT_FILE"

[[ "$FAILED_COUNT" -eq 0 ]]
