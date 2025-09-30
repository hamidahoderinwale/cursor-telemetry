#!/bin/bash

# Cursor Activity Logger - Startup Script
# This script starts both the companion service and the SPA

echo " Starting Cursor Activity Logger..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo " Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo " npm is not installed. Please install npm first."
    exit 1
fi

# Function to cleanup background processes
cleanup() {
    echo " Shutting down services..."
    kill $COMPANION_PID 2>/dev/null
    kill $SPA_PID 2>/dev/null
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Start companion service
echo "📦 Starting companion service..."
cd companion
if [ ! -d "node_modules" ]; then
    echo "📥 Installing companion dependencies..."
    npm install
fi

# Start companion in background
npm start &
COMPANION_PID=$!

# Wait a moment for companion to start
sleep 3

# Check if companion started successfully
if ! kill -0 $COMPANION_PID 2>/dev/null; then
    echo " Failed to start companion service"
    exit 1
fi

echo " Companion service started (PID: $COMPANION_PID)"

# Start SPA
echo "🌐 Starting SPA server..."
cd ../public

# Start SPA in background
python3 -m http.server 8000 &
SPA_PID=$!

# Wait a moment for SPA to start
sleep 2

# Check if SPA started successfully
if ! kill -0 $SPA_PID 2>/dev/null; then
    echo " Failed to start SPA server"
    kill $COMPANION_PID 2>/dev/null
    exit 1
fi

echo " SPA server started (PID: $SPA_PID)"
echo ""
echo " Cursor Activity Logger is running!"
echo ""
echo " Services:"
echo "  - Companion Service: http://127.0.0.1:43917"
echo "  - SPA Interface: http://localhost:8000"
echo ""
echo " Configuration:"
echo "  - Edit files in this directory to see code changes"
echo "  - Check companion logs for file watching activity"
echo "  - Use Ctrl+C to stop all services"
echo ""

# Keep script running and wait for signals
wait
