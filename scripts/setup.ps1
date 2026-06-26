# Chakravyuh AI — Windows One-Click Setup
# Run: powershell -ExecutionPolicy Bypass -File scripts/setup.ps1

$ErrorActionPreference = "Stop"
$REPO_ROOT = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
Set-Location $REPO_ROOT

Write-Host "╔══════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   ⚔  CHAKRAVYUH AI  —  One-Click Setup ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# 1. Check Python
Write-Host "🔍 Checking Python..." -NoNewline
try {
    $pyVer = python --version 2>&1
    Write-Host "  ✓ $pyVer" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Python 3.11+ required" -ForegroundColor Red
    exit 1
}

# 2. Check Ollama
Write-Host "🔍 Checking Ollama..." -NoNewline
if (Get-Command "ollama" -ErrorAction SilentlyContinue) {
    Write-Host "  ✓ ollama CLI found" -ForegroundColor Green
    try {
        $null = Invoke-WebRequest -Uri "http://127.0.0.1:11434/api/tags" -TimeoutSec 3
        Write-Host "  ✓ Ollama server running" -ForegroundColor Green
    } catch {
        Write-Host "  ⚠ Starting Ollama server..." -ForegroundColor Yellow
        Start-Process -FilePath "ollama" -ArgumentList "serve" -WindowStyle Hidden
        Start-Sleep -Seconds 2
    }
} else {
    Write-Host "  ⚠ Ollama not found. Install from https://ollama.com/download" -ForegroundColor Yellow
}

# 3. Create .env
if (-not (Test-Path ".env")) {
    Write-Host "📝 Creating .env from template..." -NoNewline
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host "  ✓ .env created" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ No .env.example found" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ✓ .env already exists" -ForegroundColor Green
}

# 4. Install Python deps
Write-Host "📦 Installing Python dependencies..."
pip install -q -r requirements.txt
Write-Host "  ✓ Done" -ForegroundColor Green

# 5. Pull default model
if (Get-Command "ollama" -ErrorAction SilentlyContinue) {
    Write-Host "🔄 Pulling default model (llama3.1:8b)..."
    ollama pull llama3.1:8b 2>$null
    Write-Host "  ✓ llama3.1:8b ready" -ForegroundColor Green
}

# 6. Check Node.js
Write-Host "🔍 Checking Node.js..." -NoNewline
if (Get-Command "node" -ErrorAction SilentlyContinue) {
    Write-Host "  ✓ $(node --version)" -ForegroundColor Green
    Write-Host "⌛ Installing npm dependencies..."
    npm ci --silent 2>$null
    Write-Host "  ✓ npm ci complete" -ForegroundColor Green
} else {
    Write-Host "  ⚠ Node.js not found (optional)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "╔══════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   ✅  SETUP COMPLETE!                    ║" -ForegroundColor Green
Write-Host "╠══════════════════════════════════════════╣" -ForegroundColor Cyan
Write-Host "║  Run:  python -m cli run                 ║" -ForegroundColor White
Write-Host "╚══════════════════════════════════════════╝" -ForegroundColor Cyan
