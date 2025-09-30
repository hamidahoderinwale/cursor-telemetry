#!/bin/bash

echo "Starting Cursor Activity Dashboard..."

# Kill any existing servers
echo "Cleaning up existing servers..."
pkill -f "python3 -m http.server" 2>/dev/null || true

# Start the server
echo "Starting HTTP server on port 8080..."
cd "$(dirname "$0")"
python3 -m http.server 8080 &
SERVER_PID=$!

# Wait for server to start
sleep 2

# Check if server is running
if curl -s http://localhost:8080/public/dashboard.html > /dev/null; then
    echo "✅ Server started successfully!"
    echo ""
    echo "🌐 Dashboard URLs:"
    echo "   Main Dashboard: http://localhost:8080/public/dashboard.html"
    echo "   Test Page:      http://localhost:8080/public/test-complete.html"
    echo "   Simple Test:    http://localhost:8080/public/test-dashboard.html"
    echo ""
    echo "Companion Service:"
    if curl -s http://127.0.0.1:43917/health > /dev/null; then
        echo "   ✅ Running - Data available"
    else
        echo "   Not running - Dashboard will work in browser-only mode"
    fi
    echo ""
    echo "Press Ctrl+C to stop the server"
    
    # Try to open dashboard in browser
    if command -v open >/dev/null 2>&1; then
        echo "Opening dashboard in browser..."
        open http://localhost:8080/public/dashboard.html
    fi
    
    # Wait for user to stop
    wait $SERVER_PID
else
    echo "❌ Failed to start server"
    exit 1
fi
