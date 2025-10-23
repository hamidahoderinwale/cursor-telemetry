#!/bin/bash

# Start the Cursor Activity Logger Companion Service
echo "🚀 Starting Cursor Activity Logger Companion Service..."

# Navigate to the companion directory
cd "$(dirname "$0")/companion"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start the companion service
echo "🔧 Starting companion service on port 43917..."
node src/index.js

