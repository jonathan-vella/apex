#!/bin/bash
# ============================================================================
# What-If Formatting Test Script
# ============================================================================
# Purpose: Test VS Code's formatted rendering of what-if output
# Usage: Run this manually in VS Code's integrated terminal
# ============================================================================

set -e

echo "🧪 Testing VS Code What-If Rendering"
echo "===================================="
echo ""
echo "📋 Test 1: Default Output (Should trigger formatted UI)"
echo "Command: az deployment sub what-if --location swedencentral --template-file main.bicep --parameters main.bicepparam"
echo ""
echo "Press Enter to run Test 1..."
read -r

az deployment sub what-if \
  --location swedencentral \
  --template-file main.bicep \
  --parameters main.bicepparam

echo ""
echo "❓ Did you see formatted tables with:"
echo "   - ✅ Checkmarks and icons (➕ Create, ~ Modify, ❌ Delete)?"
echo "   - 📊 Structured tables with Change Type/Count/Resources?"
echo "   - 🎨 Color-coded status indicators?"
echo ""
echo "If YES → Formatted rendering is working ✅"
echo "If NO → Continue to Test 2"
echo ""
echo "Press Enter to continue to Test 2..."
read -r

echo ""
echo "📋 Test 2: YAML Output (Should NOT have formatted UI)"
echo "Command: az deployment sub what-if --output yaml --location swedencentral --template-file main.bicep --parameters main.bicepparam"
echo ""
echo "Press Enter to run Test 2..."
read -r

az deployment sub what-if \
  --output yaml \
  --location swedencentral \
  --template-file main.bicep \
  --parameters main.bicepparam | head -50

echo ""
echo "❓ Did you see plain YAML text without formatting?"
echo ""
echo "If YES → This confirms --output yaml disables rendering ✅"
echo ""
echo "Press Enter to continue to Test 3..."
read -r

echo ""
echo "📋 Test 3: JSON Output (Should NOT have formatted UI)"
echo "Command: az deployment sub what-if --output json --location swedencentral --template-file main.bicep --parameters main.bicepparam"
echo ""
echo "Press Enter to run Test 3..."
read -r

az deployment sub what-if \
  --output json \
  --location swedencentral \
  --template-file main.bicep \
  --parameters main.bicepparam | head -50

echo ""
echo "❓ Did you see raw JSON without formatting?"
echo ""
echo "If YES → This confirms --output json disables rendering ✅"
echo ""
echo "============================================"
echo "🎯 Test Complete"
echo "============================================"
echo ""
echo "Expected Results:"
echo "  ✅ Test 1 (default): Formatted UI with tables, icons, colors"
echo "  ✅ Test 2 (yaml): Plain YAML text"
echo "  ✅ Test 3 (json): Raw JSON"
echo ""
echo "Conclusion:"
echo "  - Always use DEFAULT output for user-facing what-if"
echo "  - Only use --output yaml/json for programmatic parsing"
echo ""
