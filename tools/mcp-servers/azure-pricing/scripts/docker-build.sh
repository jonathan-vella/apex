#!/bin/bash
# Quick Docker build and test script for Azure Pricing MCP

set -e

echo "🐳 Building Azure Pricing MCP Docker image..."
docker build -t azure-pricing-mcp:latest .

echo ""
echo "✅ Image built successfully!"
echo ""

echo "📦 Image details:"
docker images azure-pricing-mcp:latest

echo ""
echo "🧪 Testing container startup..."
timeout 5s docker run --rm azure-pricing-mcp:latest || true

echo ""
echo "✅ Docker setup complete!"
echo ""
echo "Next steps:"
echo "1. Configure your AI assistant (VS Code or Claude Desktop)"
echo "2. Use this command in your config:"
echo '   "command": "docker",'
echo '   "args": ["run", "-i", "--rm", "azure-pricing-mcp:latest"]'
echo ""
echo "See DOCKER.md for full configuration guide."
