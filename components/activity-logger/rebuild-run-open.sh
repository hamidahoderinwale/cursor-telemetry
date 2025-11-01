#!/bin/bash

echo "🚀 Rebuild, Run, and Open Dashboard"
echo "===================================="

# Set the project directory
PROJECT_DIR="/Users/hamidaho/new_cursor/cursor-telemetry/components/activity-logger"
cd "$PROJECT_DIR"

echo ""
echo "📁 Project Directory: $PROJECT_DIR"
echo ""

# Step 1: Build
echo "🔨 Step 1: Building..."
echo "Checking required files..."

REQUIRED_FILES=(
    "public/dashboard.html"
    "public/new-dashboard.js"
    "public/new-dashboard.css"
)

ALL_FILES_OK=true
for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        SIZE=$(wc -c < "$file" | tr -d ' ')
        echo "  ✅ $file ($SIZE bytes)"
    else
        echo "  ❌ $file - MISSING"
        ALL_FILES_OK=false
    fi
done

if [ "$ALL_FILES_OK" = false ]; then
    echo ""
    echo "❌ Build failed - Missing required files"
    exit 1
fi

# Check companion service
echo ""
echo "Checking companion service..."
if curl -s http://127.0.0.1:43917/health > /dev/null 2>&1; then
    echo "  ✅ Companion service running"
else
    echo "  ⚠️  Companion service not running (dashboard will work in browser-only mode)"
fi

echo ""
echo "✅ Build complete!"
echo ""

# Step 2: Kill any existing servers
echo "🧹 Step 2: Cleaning up existing servers..."
pkill -f "python3 -m http.server.*8080" 2>/dev/null || true
sleep 1

# Step 3: Start the server
echo ""
echo "🌐 Step 3: Starting HTTP server on port 8080..."
cd "$PROJECT_DIR/public"
python3 -m http.server 8080 > /tmp/dashboard-server.log 2>&1 &
SERVER_PID=$!

# Wait for server to start
sleep 2

# Check if server is running
if curl -s http://localhost:8080/dashboard.html > /dev/null 2>&1; then
    echo "  ✅ Server started successfully! (PID: $SERVER_PID)"
else
    echo "  ⚠️  Server may not be fully ready yet, but continuing..."
fi

echo ""
echo "📊 Dashboard URLs:"
echo "   Main Dashboard: http://localhost:8080/dashboard.html"
echo "   Index:          http://localhost:8080/index.html"
echo ""

# Step 4: Open in browser
echo "🌍 Step 4: Opening dashboard in browser..."
if command -v open >/dev/null 2>&1; then
    open http://localhost:8080/dashboard.html
    echo "  ✅ Browser opened!"
else
    echo "  ⚠️  'open' command not available. Please manually open:"
    echo "      http://localhost:8080/dashboard.html"
fi

echo ""
echo "✅ All done! Server is running in background (PID: $SERVER_PID)"
echo ""
echo "To stop the server, run:"
echo "   pkill -f 'python3 -m http.server.*8080'"
echo ""
echo "Server logs: /tmp/dashboard-server.log"
echo ""
