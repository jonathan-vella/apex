#!/usr/bin/env bash
# Session Logger: Log session end event
# Adapted from: https://github.com/github/awesome-copilot/tree/main/hooks/session-logger

set -euo pipefail

# Skip if logging disabled
if [[ "${SKIP_LOGGING:-}" == "true" ]]; then
  exit 0
fi

# Read input from Copilot
INPUT=$(cat)

# Create logs directory if it doesn't exist
LOG_DIR="logs/copilot"
mkdir -p "$LOG_DIR"

# Extract timestamp
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Log session end
echo "{\"timestamp\":\"$TIMESTAMP\",\"event\":\"sessionEnd\"}" >> "$LOG_DIR/session.log"

echo "📝 Session end logged"
exit 0
