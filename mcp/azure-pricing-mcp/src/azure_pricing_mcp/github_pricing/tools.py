"""Tool definitions for GitHub Pricing."""

from mcp.types import Tool


def get_github_pricing_tool_definitions() -> list[Tool]:
    """Return MCP tool definitions for GitHub pricing."""
    return [
        Tool(
            name="github_pricing",
            description=(
                "Look up GitHub product pricing: Plans (Free/Team/Enterprise), "
                "GitHub Copilot (Free/Pro/Pro+/Business/Enterprise), Actions runners, "
                "Advanced Security (GHAS), Codespaces, Git LFS, and Packages. "
                "IMPORTANT: This tool covers GitHub Copilot (AI coding assistant) only — "
                "NOT Microsoft 365 Copilot. "
                "Data sourced from github.com/pricing — no authentication required."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "product": {
                        "type": "string",
                        "description": (
                            "Product category to look up. "
                            "Examples: 'copilot', 'actions', 'plans', 'security', "
                            "'codespaces', 'storage'. "
                            "If omitted, returns the full catalog."
                        ),
                    },
                    "copilot_plan": {
                        "type": "string",
                        "description": (
                            "Optional Copilot plan filter if product is 'copilot'. "
                            "Values: 'Free', 'Pro', 'Pro+', 'Business', 'Enterprise'."
                        ),
                    },
                },
            },
        ),
        Tool(
            name="github_cost_estimate",
            description=(
                "Estimate monthly and annual GitHub costs based on team size and "
                "usage (plan seats, GitHub Copilot licenses, Actions minutes, Codespaces "
                "hours, Git LFS packs, GHAS committers). "
                "IMPORTANT: Copilot here means GitHub Copilot (AI coding assistant) — "
                "NOT Microsoft 365 Copilot. "
                "No authentication required."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "users": {
                        "type": "integer",
                        "description": "Number of user seats (default: 1)",
                        "default": 1,
                    },
                    "plan": {
                        "type": "string",
                        "description": (
                            "GitHub plan: 'Free', 'Team', or 'Enterprise'. "
                            "Only include if the user is asking about GitHub plan costs. "
                            "Omit to exclude plan seat costs from the estimate."
                        ),
                    },
                    "copilot_plan": {
                        "type": "string",
                        "description": (
                            "Copilot plan to include: 'Free', 'Pro', 'Pro+', 'Business', 'Enterprise'. "
                            "Omit to exclude Copilot from estimate."
                        ),
                    },
                    "actions_minutes": {
                        "type": "integer",
                        "description": "Total Actions minutes per month (Linux-equivalent). Free tier minutes are deducted automatically.",
                        "default": 0,
                    },
                    "actions_runner": {
                        "type": "string",
                        "description": (
                            "Runner label for per-minute rate (e.g., 'Linux 2-core', 'Windows 4-core', 'macOS 3-core (M1)'). "
                            "Default: 'Linux 2-core'."
                        ),
                    },
                    "codespaces_hours": {
                        "type": "number",
                        "description": "Total Codespaces hours per month (default: 0)",
                        "default": 0,
                    },
                    "codespaces_cores": {
                        "type": "integer",
                        "description": "Cores per Codespace instance (default: 4)",
                        "default": 4,
                    },
                    "codespaces_storage_gb": {
                        "type": "number",
                        "description": "Codespaces persistent storage in GB (default: 0)",
                        "default": 0,
                    },
                    "lfs_packs": {
                        "type": "integer",
                        "description": "Number of 50 GB Git LFS data packs (default: 0)",
                        "default": 0,
                    },
                    "ghas_committers": {
                        "type": "integer",
                        "description": "Number of active committers for GitHub Advanced Security (default: 0)",
                        "default": 0,
                    },
                },
            },
        ),
    ]
