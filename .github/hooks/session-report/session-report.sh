#!/usr/bin/env bash
# session-report.sh
# Stop hook: generates lightweight session summary (advisory only).
# CRITICAL: checks stop_hook_active to prevent infinite loops.
# Receives JSON input via stdin; outputs JSON to stdout.
# Docs: https://code.visualstudio.com/docs/copilot/customization/hooks
set -euo pipefail

INPUT=$(cat)

# ── Infinite loop guard (non-negotiable) ──
STOP_ACTIVE=$(echo "$INPUT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print('yes' if data.get('stop_hook_active') else 'no')
" 2>/dev/null || echo "no")
if [[ "$STOP_ACTIVE" == "yes" ]]; then
  echo '{"continue": true}'
  exit 0
fi

# ── Extract and sanitize sessionId ──
SESSION_ID=$(echo "$INPUT" | python3 -c "
import sys, json, re
data = json.load(sys.stdin)
sid = data.get('sessionId', 'unknown')
# Sanitize: keep only alphanumeric, hyphens, underscores
print(re.sub(r'[^a-zA-Z0-9_-]', '', str(sid)) or 'unknown')
" 2>/dev/null || echo "unknown")

# ── Collect git diff stats ──
DIFF_STAT=$(git diff --stat HEAD 2>/dev/null || echo "no changes")

# ── Count files by type ──
FILE_COUNTS=$(git diff --name-only HEAD 2>/dev/null | python3 -c "
import sys, json
from collections import defaultdict

ext_map = {
    '.md': 'markdown', '.bicep': 'bicep', '.bicepparam': 'bicep',
    '.tf': 'terraform', '.tfvars': 'terraform',
    '.js': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript',
    '.py': 'python', '.sh': 'shell',
    '.json': 'json', '.jsonc': 'json',
}
counts = defaultdict(int)
total = 0
for line in sys.stdin:
    name = line.strip()
    if not name:
        continue
    total += 1
    ext = '.' + name.rsplit('.', 1)[-1] if '.' in name else ''
    category = ext_map.get(ext, 'other')
    counts[category] += 1

print(json.dumps({'files_by_type': dict(counts), 'total_files': total}))
" 2>/dev/null || echo '{"files_by_type": {}, "total_files": 0}')

# ── Write session report ──
REPORT_DIR="${HOME}/.copilot-audit/session-reports"
mkdir -p "$REPORT_DIR"
REPORT_FILE="${REPORT_DIR}/${SESSION_ID}.json"

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
echo "$FILE_COUNTS" | python3 -c "
import sys, json
counts = json.load(sys.stdin)
report = {
    'sessionId': '${SESSION_ID}',
    'timestamp': '${TIMESTAMP}',
    'files_by_type': counts.get('files_by_type', {}),
    'total_files': counts.get('total_files', 0)
}
print(json.dumps(report, indent=2))
" > "$REPORT_FILE" 2>/dev/null || true

# ── Build summary message ──
TOTAL=$(echo "$FILE_COUNTS" | python3 -c "import sys,json; print(json.load(sys.stdin).get('total_files', 0))" 2>/dev/null || echo "0")
TYPE_SUMMARY=$(echo "$FILE_COUNTS" | python3 -c "
import sys, json
counts = json.load(sys.stdin).get('files_by_type', {})
parts = [f'{v} {k}' for k, v in sorted(counts.items(), key=lambda x: -x[1]) if v > 0]
print(', '.join(parts) if parts else 'no changes')
" 2>/dev/null || echo "unknown")

# Use Python json.dumps for safe JSON output
python3 -c "
import json, sys
total = sys.argv[1]
type_summary = sys.argv[2]
report_file = sys.argv[3]
msg = f'Session summary: {total} files changed ({type_summary}). Report saved to {report_file}.'
print(json.dumps({'continue': True, 'systemMessage': msg}))
" "$TOTAL" "$TYPE_SUMMARY" "$REPORT_FILE" 2>/dev/null || echo '{"continue": true}'
