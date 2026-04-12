#!/usr/bin/env bash
# Session Logger: Log user prompt submission
# Adapted from: https://github.com/github/awesome-copilot/tree/main/hooks/session-logger

set -euo pipefail

# Skip if logging disabled
if [[ "${SKIP_LOGGING:-}" == "true" ]]; then
  exit 0
fi

# Read input from Copilot (contains prompt info)
INPUT=$(cat)

# Create logs directory if it doesn't exist
LOG_DIR="logs/copilot"
mkdir -p "$LOG_DIR"

# Extract timestamp
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Log prompt event (no prompt content — privacy safe)
echo "{\"timestamp\":\"$TIMESTAMP\",\"event\":\"userPromptSubmitted\",\"level\":\"${LOG_LEVEL:-INFO}\"}" >> "$LOG_DIR/prompts.log"

exit 0
