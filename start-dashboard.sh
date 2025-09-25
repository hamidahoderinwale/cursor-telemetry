#!/bin/bash

echo "🚀 Starting Cursor Activity Dashboard System..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if required dependencies are installed
echo "📦 Checking dependencies..."

# Install dependencies for companion service
cd cursor-activity-logger/companion
if [ ! -d "node_modules" ]; then
    echo "📦 Installing companion service dependencies..."
    npm install
fi

# Install dependencies for dashboard server
cd ../..
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dashboard server dependencies..."
    npm install express cors ws
fi

echo "✅ Dependencies checked"

# Start companion service in background
echo "🔧 Starting companion service on port 43918..."
cd cursor-activity-logger/companion
node src/index.js &
COMPANION_PID=$!

# Wait a moment for companion service to start
sleep 3

# Start dashboard server
echo "🌐 Starting dashboard server on port 9000..."
cd ../..
node dashboard-server.js &
DASHBOARD_PID=$!

echo ""
echo "🎉 System started successfully!"
echo ""
echo "📊 Dashboard: http://localhost:9000/dashboard.html"
echo "🔧 Companion API: http://localhost:43918/health"
echo "🔌 WebSocket: ws://localhost:43918"
echo ""
echo "Press Ctrl+C to stop all services"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down services..."
    kill $COMPANION_PID 2>/dev/null
    kill $DASHBOARD_PID 2>/dev/null
    echo "✅ All services stopped"
    exit 0
}

# Trap Ctrl+C
trap cleanup SIGINT

# Wait for processes
wait
