"""PTU model data table for Azure OpenAI provisioned throughput sizing.

All values are sourced from the official Microsoft documentation:
https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/provisioned-throughput-onboarding

Data should be updated when the upstream doc table changes.
"""

# Version of this embedded data table — bump when updating from docs.
DATA_VERSION = "2026-02-01"

# Authoritative source URL for PTU model tables.
DATA_SOURCE_URL = (
    "https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/" "provisioned-throughput-onboarding"
)

# Max PTUs per single deployment (hard limit from Azure quotas/limits docs).
MAX_PTUS_PER_DEPLOYMENT = 100_000

# ---------------------------------------------------------------------------
# Deployment type metadata
# ---------------------------------------------------------------------------
DEPLOYMENT_TYPES: dict[str, dict[str, str]] = {
    "GlobalProvisioned": {
        "label": "Global Provisioned",
        "description": "Traffic may be processed in any Azure geography. Best for highest capacity.",
        "min_key": "global_min_ptus",
        "increment_key": "global_increment",
    },
    "DataZoneProvisioned": {
        "label": "Data Zone Provisioned",
        "description": "Traffic processed within a defined data zone (e.g., EU, US). Shares PTU table with Global.",
        "min_key": "global_min_ptus",
        "increment_key": "global_increment",
    },
    "RegionalProvisioned": {
        "label": "Regional Provisioned",
        "description": "Traffic processed in a single Azure region. Stricter data residency.",
        "min_key": "regional_min_ptus",
        "increment_key": "regional_increment",
    },
}

# ---------------------------------------------------------------------------
# Per-model PTU characteristics
# ---------------------------------------------------------------------------
# Each entry must contain:
#   input_tpm_per_ptu   – Input tokens-per-minute capacity per PTU
#   output_multiplier   – 1 output token counts as N input tokens for utilization
#   global_min_ptus     – Minimum PTUs for Global / Data Zone deployments
#   global_increment    – Scale increment for Global / Data Zone deployments
#   regional_min_ptus   – Minimum PTUs for Regional deployments (None if unsupported)
#   regional_increment  – Scale increment for Regional deployments (None if unsupported)
#
# output_multiplier notes:
#   Docs state: "Starting with GPT 4.1 models and later, the system generally
#   matches the global standard price ratio between input and output tokens."
#   - gpt-5 family: explicitly documented as 8× (1 output = 8 input tokens)
#   - gpt-4.1 family: explicitly documented as 4× (1 output = 4 input tokens)
#   - Llama-3.3-70B-Instruct: explicitly documented as 4× (exception to pricing ratio)
#   - Previous Azure OpenAI models (gpt-4o, gpt-4o-mini): 3× (verified via
#     Foundry calculator and official MS docs example tables)
#   - o3-mini, o1: assumed 3× (same "previous model" category; docs say
#     "older models use a different ratio" without specifying)
# ---------------------------------------------------------------------------

PTU_MODEL_TABLE: dict[str, dict] = {
    # ── Latest Azure OpenAI models ──────────────────────────────────────
    "gpt-5.2": {
        "input_tpm_per_ptu": 3_400,
        "output_multiplier": 8,
        "global_min_ptus": 15,
        "global_increment": 5,
        "regional_min_ptus": 50,
        "regional_increment": 50,
    },
    "gpt-5.2-codex": {
        "input_tpm_per_ptu": 3_400,
        "output_multiplier": 8,
        "global_min_ptus": 15,
        "global_increment": 5,
        "regional_min_ptus": 50,
        "regional_increment": 50,
    },
    "gpt-5.1": {
        "input_tpm_per_ptu": 4_750,
        "output_multiplier": 8,
        "global_min_ptus": 15,
        "global_increment": 5,
        "regional_min_ptus": 50,
        "regional_increment": 50,
    },
    "gpt-5.1-codex": {
        "input_tpm_per_ptu": 4_750,
        "output_multiplier": 8,
        "global_min_ptus": 15,
        "global_increment": 5,
        "regional_min_ptus": 50,
        "regional_increment": 50,
    },
    "gpt-5": {
        "input_tpm_per_ptu": 4_750,
        "output_multiplier": 8,  # Docs: "for gpt-5, 1 output = 8 input tokens"
        "global_min_ptus": 15,
        "global_increment": 5,
        "regional_min_ptus": 50,
        "regional_increment": 50,
    },
    "gpt-5-mini": {
        "input_tpm_per_ptu": 23_750,
        "output_multiplier": 4,
        "global_min_ptus": 15,
        "global_increment": 5,
        "regional_min_ptus": 25,
        "regional_increment": 25,
    },
    "gpt-4.1": {
        "input_tpm_per_ptu": 3_000,
        "output_multiplier": 4,  # Docs: "for gpt-4.1, 1 output = 4 input tokens"
        "global_min_ptus": 15,
        "global_increment": 5,
        "regional_min_ptus": 50,
        "regional_increment": 50,
    },
    "gpt-4.1-mini": {
        "input_tpm_per_ptu": 14_900,
        "output_multiplier": 4,
        "global_min_ptus": 15,
        "global_increment": 5,
        "regional_min_ptus": 25,
        "regional_increment": 25,
    },
    "gpt-4.1-nano": {
        "input_tpm_per_ptu": 59_400,
        "output_multiplier": 4,
        "global_min_ptus": 15,
        "global_increment": 5,
        "regional_min_ptus": 25,
        "regional_increment": 25,
    },
    "o3": {
        "input_tpm_per_ptu": 3_000,
        "output_multiplier": 4,
        "global_min_ptus": 15,
        "global_increment": 5,
        "regional_min_ptus": 50,
        "regional_increment": 50,
    },
    "o4-mini": {
        "input_tpm_per_ptu": 5_400,
        "output_multiplier": 4,
        "global_min_ptus": 15,
        "global_increment": 5,
        "regional_min_ptus": 25,
        "regional_increment": 25,
    },
    # ── Previous Azure OpenAI models ────────────────────────────────────
    "gpt-4o": {
        "input_tpm_per_ptu": 2_500,
        "output_multiplier": 3,  # Verified via Foundry calculator; older model, different ratio
        "global_min_ptus": 15,
        "global_increment": 5,
        "regional_min_ptus": 50,
        "regional_increment": 50,
    },
    "gpt-4o-mini": {
        "input_tpm_per_ptu": 37_000,
        "output_multiplier": 3,  # Verified via official MS docs example table (latency page)
        "global_min_ptus": 15,
        "global_increment": 5,
        "regional_min_ptus": 25,
        "regional_increment": 25,
    },
    "o3-mini": {
        "input_tpm_per_ptu": 2_500,
        "output_multiplier": 3,  # Previous model; docs: "older models use a different ratio"
        "global_min_ptus": 15,
        "global_increment": 5,
        "regional_min_ptus": 25,
        "regional_increment": 25,
    },
    "o1": {
        "input_tpm_per_ptu": 230,
        "output_multiplier": 3,  # Previous model; docs: "older models use a different ratio"
        "global_min_ptus": 15,
        "global_increment": 5,
        "regional_min_ptus": 25,
        "regional_increment": 50,
    },
    # ── Direct from Azure models ────────────────────────────────────────
    "Llama-3.3-70B-Instruct": {
        "input_tpm_per_ptu": 8_450,
        "output_multiplier": 4,  # Docs: explicit exception to pricing ratio
        "global_min_ptus": 100,
        "global_increment": 100,
        "regional_min_ptus": None,  # Regional not available
        "regional_increment": None,
    },
    "DeepSeek-R1": {
        "input_tpm_per_ptu": 4_000,
        "output_multiplier": 4,
        "global_min_ptus": 100,
        "global_increment": 100,
        "regional_min_ptus": None,
        "regional_increment": None,
    },
    "DeepSeek-V3-0324": {
        "input_tpm_per_ptu": 4_000,
        "output_multiplier": 4,
        "global_min_ptus": 100,
        "global_increment": 100,
        "regional_min_ptus": None,
        "regional_increment": None,
    },
    "DeepSeek-R1-0528": {
        "input_tpm_per_ptu": 4_000,
        "output_multiplier": 4,
        "global_min_ptus": 100,
        "global_increment": 100,
        "regional_min_ptus": None,
        "regional_increment": None,
    },
}


def get_supported_models() -> list[str]:
    """Return sorted list of supported model IDs."""
    return sorted(PTU_MODEL_TABLE.keys())


def get_model_info(model: str) -> dict | None:
    """Look up a model in the PTU table (case-insensitive).

    Returns the model entry dict or None if not found.
    """
    # Exact match first
    if model in PTU_MODEL_TABLE:
        return PTU_MODEL_TABLE[model]
    # Case-insensitive fallback
    lower = model.lower()
    for key, value in PTU_MODEL_TABLE.items():
        if key.lower() == lower:
            return value
    return None


def get_model_canonical_name(model: str) -> str | None:
    """Return the canonical (case-correct) model name, or None if not found."""
    if model in PTU_MODEL_TABLE:
        return model
    lower = model.lower()
    for key in PTU_MODEL_TABLE:
        if key.lower() == lower:
            return key
    return None
