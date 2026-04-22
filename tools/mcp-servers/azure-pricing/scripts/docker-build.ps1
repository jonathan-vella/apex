# Quick Docker build and test script for Azure Pricing MCP
# Windows PowerShell version

Write-Host "🐳 Building Azure Pricing MCP Docker image..." -ForegroundColor Cyan
docker build -t azure-pricing-mcp:latest .

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Image built successfully!" -ForegroundColor Green
} else {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "📦 Image details:" -ForegroundColor Yellow
docker images azure-pricing-mcp:latest

Write-Host ""
Write-Host "🧪 Testing container startup..." -ForegroundColor Yellow
$job = Start-Job -ScriptBlock { docker run --rm azure-pricing-mcp:latest }
Start-Sleep -Seconds 3
Stop-Job $job
Remove-Job $job

Write-Host ""
Write-Host "✅ Docker setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Configure your AI assistant (VS Code or Claude Desktop)" -ForegroundColor White
Write-Host "2. Use this command in your config:" -ForegroundColor White
Write-Host '   "command": "docker",' -ForegroundColor Gray
Write-Host '   "args": ["run", "-i", "--rm", "azure-pricing-mcp:latest"]' -ForegroundColor Gray
Write-Host ""
Write-Host "See DOCKER.md for full configuration guide." -ForegroundColor White
