#!/bin/bash

# Cursor Activity Logger - Production Startup Script
# This script starts both the companion service and the SPA in production mode

echo "🚀 Starting Cursor Activity Logger (Production Mode)..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to cleanup background processes
cleanup() {
    echo -e "\n${YELLOW}🛑 Shutting down services...${NC}"
    if [ ! -z "$COMPANION_PID" ]; then
        kill $COMPANION_PID 2>/dev/null
        echo -e "${GREEN}✅ Companion service stopped${NC}"
    fi
    if [ ! -z "$SPA_PID" ]; then
        kill $SPA_PID 2>/dev/null
        echo -e "${GREEN}✅ SPA server stopped${NC}"
    fi
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js first.${NC}"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed. Please install npm first.${NC}"
    exit 1
fi

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 is not installed. Please install Python 3 first.${NC}"
    exit 1
fi

echo -e "${BLUE}📦 Starting companion service...${NC}"
cd companion

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📥 Installing companion dependencies...${NC}"
    npm install
fi

# Start companion service in background
npm start > ../companion.log 2>&1 &
COMPANION_PID=$!

# Wait for companion to start
echo -e "${YELLOW}⏳ Waiting for companion service to start...${NC}"
for i in {1..10}; do
    if curl -s http://127.0.0.1:43917/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Companion service started (PID: $COMPANION_PID)${NC}"
        break
    fi
    if [ $i -eq 10 ]; then
        echo -e "${RED}❌ Failed to start companion service${NC}"
        kill $COMPANION_PID 2>/dev/null
        exit 1
    fi
    sleep 1
done

# Start SPA server
echo -e "${BLUE}🌐 Starting SPA server...${NC}"
cd ../public

# Start SPA in background
python3 -m http.server 8000 > ../spa.log 2>&1 &
SPA_PID=$!

# Wait for SPA to start
echo -e "${YELLOW}⏳ Waiting for SPA server to start...${NC}"
for i in {1..5}; do
    if curl -s -I http://localhost:8000 > /dev/null 2>&1; then
        echo -e "${GREEN}✅ SPA server started (PID: $SPA_PID)${NC}"
        break
    fi
    if [ $i -eq 5 ]; then
        echo -e "${RED}❌ Failed to start SPA server${NC}"
        kill $COMPANION_PID 2>/dev/null
        kill $SPA_PID 2>/dev/null
        exit 1
    fi
    sleep 1
done

# Get companion status
COMPANION_STATUS=$(curl -s http://127.0.0.1:43917/health | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
ENTRIES_COUNT=$(curl -s http://127.0.0.1:43917/health | grep -o '"entries":[0-9]*' | cut -d':' -f2)

echo ""
echo -e "${GREEN}🎉 Cursor Activity Logger is running!${NC}"
echo ""
echo -e "${BLUE}📊 Services:${NC}"
echo -e "  - Companion Service: ${GREEN}http://127.0.0.1:43917${NC} (Status: $COMPANION_STATUS)"
echo -e "  - SPA Interface: ${GREEN}http://localhost:8000${NC}"
echo ""
echo -e "${BLUE}📈 Current Status:${NC}"
echo -e "  - Entries detected: ${GREEN}$ENTRIES_COUNT${NC}"
echo -e "  - File watching: ${GREEN}Active${NC}"
echo -e "  - MCP integration: ${GREEN}Ready${NC}"
echo ""
echo -e "${BLUE}🔧 Usage:${NC}"
echo -e "  - Edit files in this directory to see code changes"
echo -e "  - Open http://localhost:8000 in your browser"
echo -e "  - Check companion logs: ${YELLOW}tail -f companion.log${NC}"
echo -e "  - Check SPA logs: ${YELLOW}tail -f spa.log${NC}"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"

# Keep script running and wait for signals
wait
