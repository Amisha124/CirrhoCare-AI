#!/usr/bin/env bash
# CirrhoCare AI - Production Build Script for Render (Linux)
set -o errexit

echo "=========================================================="
echo "== Starting CirrhoCare AI Production Build               =="
echo "=========================================================="

echo "[1/3] Installing Python dependencies..."
python -m pip install --upgrade pip
pip install -r requirements.txt

echo "[2/3] Checking Frontend Assets..."
if command -v npm &> /dev/null; then
    echo "Node/npm detected in build environment. Compiling fresh frontend assets..."
    cd frontend
    npm install
    npm run build
    cd ..
else
    echo "npm not present in container. Using tracked production frontend bundle..."
fi

if [ ! -f "frontend/dist/index.html" ]; then
    echo "ERROR: frontend/dist/index.html not found! Build cannot continue."
    exit 1
fi
echo "Verified frontend/dist/index.html exists."

echo "[3/3] Ensuring runtime directories and baseline database exist..."
mkdir -p instance/uploads
mkdir -p instance/demo_uploads
python seed.py || true

echo "=========================================================="
echo "== CirrhoCare AI Build Succeeded Successfully!           =="
echo "=========================================================="

