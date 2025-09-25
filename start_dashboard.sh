#!/bin/bash

# Cursor Dashboard Quick Start Script
# Starts all necessary services for the dashboard

echo "🚀 Starting Cursor Dashboard System"
echo "=================================="
echo ""

# Check if we're in the right directory
if [ ! -d "cursor-activity-logger" ]; then
    echo "❌ Error: cursor-activity-logger directory not found"
    echo "   Please run this script from the cursor_dashboard directory"
    exit 1
fi

# Function to check if a port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Function to kill process on port
kill_port() {
    local port=$1
    local pid=$(lsof -ti:$port)
    if [ ! -z "$pid" ]; then
        echo "   🔄 Killing existing process on port $port (PID: $pid)"
        kill -9 $pid 2>/dev/null
        sleep 2
    fi
}

# Check and kill existing processes
echo "🔍 Checking for existing processes..."

if check_port 43918; then
    echo "   ⚠️  Port 43918 is in use (Companion Service)"
    kill_port 43918
fi

if check_port 9000; then
    echo "   ⚠️  Port 9000 is in use (Dashboard Service)"
    kill_port 9000
fi

echo ""

# Start Companion Service
echo "🔧 Starting Companion Service..."
cd cursor-activity-logger/companion
if [ ! -f "src/index.js" ]; then
    echo "   ❌ Error: src/index.js not found"
    exit 1
fi

node src/index.js &
COMPANION_PID=$!
echo "   ✅ Companion Service started (PID: $COMPANION_PID)"
cd ../..

# Wait for companion service to start
echo "   ⏳ Waiting for companion service to initialize..."
sleep 5

# Test companion service
echo "   🔍 Testing companion service..."
if curl -s http://localhost:43918/health > /dev/null 2>&1; then
    echo "   ✅ Companion Service is responding"
else
    echo "   ⚠️  Companion Service may not be ready yet"
fi

# Start Dashboard Service
echo ""
echo "🌐 Starting Dashboard Service..."
python3 -m http.server 9000 &
DASHBOARD_PID=$!
echo "   ✅ Dashboard Service started (PID: $DASHBOARD_PID)"

# Wait for dashboard service to start
echo "   ⏳ Waiting for dashboard service to initialize..."
sleep 3

# Test dashboard service
echo "   🔍 Testing dashboard service..."
if curl -s http://localhost:9000/cursor_dashboard_final.html > /dev/null 2>&1; then
    echo "   ✅ Dashboard Service is responding"
else
    echo "   ⚠️  Dashboard Service may not be ready yet"
fi

echo ""
echo "🎉 Dashboard System Started Successfully!"
echo "========================================"
echo ""
echo "📊 Main Dashboard:"
echo "   http://localhost:9000/cursor_dashboard_final.html"
echo ""
echo "📈 Analytics Dashboard:"
echo "   http://localhost:9000/analytics_dashboard.html"
echo ""
echo "🔧 Companion Service:"
echo "   http://localhost:43918/health"
echo ""
echo "📋 System Status:"
echo "   Run: python3 monitor_system.py"
echo ""
echo "🛑 To stop all services:"
echo "   kill $COMPANION_PID $DASHBOARD_PID"
echo ""
echo "✨ Your Cursor Dashboard is ready to use!"

# Save PIDs for easy cleanup
echo "$COMPANION_PID $DASHBOARD_PID" > .dashboard_pids
echo "   💾 Process IDs saved to .dashboard_pids"
