# Quick PowerShell test script
# Test if basic setup can work

Write-Host "🧪 Azure Pricing MCP Server - Quick Test" -ForegroundColor Cyan
Write-Host "=" * 45 -ForegroundColor Gray

# Check current directory
$currentDir = Get-Location
Write-Host "📁 Current directory: $currentDir" -ForegroundColor White

# Check if we're in the right directory
$expectedFiles = @("requirements.txt", "azure_pricing_server.py", "README.md")
$missingFiles = @()

foreach ($file in $expectedFiles) {
    if (Test-Path $file) {
        Write-Host "✅ Found: $file" -ForegroundColor Green
    } else {
        Write-Host "❌ Missing: $file" -ForegroundColor Red
        $missingFiles += $file
    }
}

if ($missingFiles.Count -eq 0) {
    Write-Host ""
    Write-Host "✅ All required files present!" -ForegroundColor Green
    Write-Host "Ready to run setup.ps1" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "❌ Missing required files. Make sure you're in the azure_pricing directory." -ForegroundColor Red
}

Write-Host ""
Write-Host "🚀 To run the full setup:" -ForegroundColor Cyan
Write-Host "   .\setup.ps1" -ForegroundColor Yellow
Write-Host ""
Write-Host "Or run step by step:" -ForegroundColor Cyan
Write-Host "   python -m venv .venv" -ForegroundColor Gray
Write-Host "   .\.venv\Scripts\Activate.ps1" -ForegroundColor Gray
Write-Host "   python -m pip install -r requirements.txt" -ForegroundColor Gray