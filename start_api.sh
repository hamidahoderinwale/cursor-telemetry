#!/bin/bash
# Cursor Dashboard API Server Startup Script

echo "🚀 Starting Cursor Dashboard API Server..."

# Check if Python 3 is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed."
    exit 1
fi

# Check if pip is available
if ! command -v pip3 &> /dev/null; then
    echo "❌ pip3 is required but not installed."
    exit 1
fi

# Install dependencies if requirements.txt exists
if [ -f "requirements.txt" ]; then
    echo "📦 Installing Python dependencies..."
    pip3 install -r requirements.txt
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install dependencies."
        exit 1
    fi
else
    echo "⚠️  requirements.txt not found. Installing basic dependencies..."
    pip3 install Flask Flask-CORS pandas python-dateutil Werkzeug
fi

# Check if API server file exists
if [ ! -f "api_server.py" ]; then
    echo "❌ api_server.py not found in current directory."
    exit 1
fi

# Make API server executable
chmod +x api_server.py

echo "✅ Dependencies installed successfully!"
echo ""
echo "🌐 Starting API server on http://localhost:5000"
echo "📚 API Documentation: http://localhost:5000/api/docs"
echo "🔍 Health Check: http://localhost:5000/api/health"
echo ""
echo "📊 Available endpoints:"
echo "  - GET  /api/workspaces          - Get all workspaces"
echo "  - GET  /api/workspaces/{id}     - Get workspace details"
echo "  - GET  /api/telemetry           - Get telemetry data (with filters)"
echo "  - GET  /api/ai-interactions     - Get AI interaction data"
echo "  - GET  /api/terminal-history    - Get terminal command history"
echo "  - GET  /api/analytics           - Get comprehensive analytics"
echo "  - GET  /api/stats               - Get basic statistics"
echo "  - POST /api/refresh             - Refresh data from source"
echo ""
echo "💡 Press Ctrl+C to stop the server"
echo ""

# Start the API server
python3 api_server.py



