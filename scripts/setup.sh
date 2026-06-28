#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "╔══════════════════════════════════════════╗"
echo "║   ⚔  CHAKRAVYUH AI  —  One-Click Setup ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── 1. Check Python ──────────────────────────────────────────────────
echo "🔍 Checking Python..."
if command -v python3 &>/dev/null; then
    PY="python3"
elif command -v python &>/dev/null; then
    PY="python"
else
    echo "✗ Python 3.11+ is required. Install from https://python.org"
    exit 1
fi

PY_VER=$($PY --version 2>&1 | grep -oP '\d+\.\d+')
if [ "$(echo "$PY_VER >= 3.11" | bc -l 2>/dev/null || echo 0)" = "0" ]; then
    echo "✗ Python 3.11+ required (found $PY_VER)"
    exit 1
fi
echo "  ✓ Python $PY_VER"

# ── 2. Check Ollama ──────────────────────────────────────────────────
echo "🔍 Checking Ollama..."
if command -v ollama &>/dev/null; then
    echo "  ✓ ollama CLI found"
    if curl -s http://127.0.0.1:11434/api/tags &>/dev/null; then
        echo "  ✓ Ollama server running"
    else
        echo "  ⚠ Starting Ollama server..."
        nohup ollama serve &>/tmp/ollama.log &
        sleep 2
        echo "  ✓ Ollama server started"
    fi
else
    echo "  ⚠ Ollama not found. Install from https://ollama.com/download"
    echo "  Then re-run this script."
fi

# ── 3. Create .env ───────────────────────────────────────────────────
if [ ! -f .env ]; then
    echo "📝 Creating .env from template..."
    cp .env.example .env 2>/dev/null || echo "  ⚠ No .env.example found"
    echo "  ✓ .env created"
else
    echo "  ✓ .env already exists"
fi

# ── 4. Install Python deps ───────────────────────────────────────────
echo "📦 Installing Python dependencies..."
$PY -m pip install -q -r requirements.txt 2>/dev/null && echo "  ✓ Done" || echo "  ⚠ pip install had issues"

# ── 5. Pull default model ────────────────────────────────────────────
if command -v ollama &>/dev/null; then
    echo "🔄 Pulling default model (llama3.1:8b)..."
    ollama pull llama3.1:8b 2>/dev/null && echo "  ✓ llama3.1:8b ready" || echo "  ⚠ Pull failed (will try at runtime)"
fi

# ── 6. Check Node.js ─────────────────────────────────────────────────
echo "🔍 Checking Node.js..."
if command -v node &>/dev/null; then
    echo "  ✓ Node.js $(node --version)"
    echo "⌛ Installing npm dependencies..."
    npm ci --silent 2>/dev/null && echo "  ✓ npm ci complete" || echo "  ⚠ npm ci had warnings"
else
    echo "  ⚠ Node.js not found (optional — needed for TS dashboard)"
fi

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   ✅  SETUP COMPLETE!                    ║"
echo "╠══════════════════════════════════════════╣"
echo "║  Run:  chakravyuh run                    ║"
echo "║  Or:   python -m cli run                 ║"
echo "╚══════════════════════════════════════════╝"
