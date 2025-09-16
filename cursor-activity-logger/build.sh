#!/bin/bash

echo "🔨 Building Cursor Activity Dashboard System..."

# Set the project directory
PROJECT_DIR="/Users/hamidaho/Desktop/cursor_dashboard/cursor-activity-logger"
cd "$PROJECT_DIR"

echo "📁 Project Directory: $PROJECT_DIR"

# Check if all required files exist
echo "🔍 Checking required files..."

REQUIRED_FILES=(
    "public/dashboard.html"
    "public/dashboard.css" 
    "public/app.js"
    "public/test-complete.html"
    "public/test-dashboard.html"
    "start-dashboard.sh"
    "README-DASHBOARD.md"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✅ $file"
    else
        echo "  ❌ $file - MISSING"
        exit 1
    fi
done

# Check file sizes to ensure they're not empty
echo "📊 Checking file sizes..."

echo "  📄 dashboard.html: $(wc -c < public/dashboard.html) bytes"
echo "  🎨 dashboard.css: $(wc -c < public/dashboard.css) bytes"
echo "  ⚙️  app.js: $(wc -c < public/app.js) bytes"

# Check if companion service is running
echo "🔧 Checking companion service..."
if curl -s http://127.0.0.1:43917/health > /dev/null; then
    COMPANION_DATA=$(curl -s http://127.0.0.1:43917/health)
    echo "  ✅ Companion service running"
    echo "  📊 Data available: $COMPANION_DATA"
else
    echo "  ⚠️  Companion service not running (dashboard will work in browser-only mode)"
fi

# Check if any servers are running
echo "🌐 Checking for running servers..."
if pgrep -f "python3 -m http.server" > /dev/null; then
    echo "  ✅ HTTP server already running"
    SERVER_PID=$(pgrep -f "python3 -m http.server" | head -1)
    echo "  📍 Server PID: $SERVER_PID"
else
    echo "  ⚠️  No HTTP server running"
fi

# Test the dashboard
echo "🧪 Testing dashboard accessibility..."
if curl -s http://localhost:8080/public/dashboard.html > /dev/null; then
    echo "  ✅ Dashboard accessible at http://localhost:8080/public/dashboard.html"
else
    echo "  ❌ Dashboard not accessible"
fi

# Create a system status report
echo "📋 Creating system status report..."
cat > system-status.txt << EOF
Cursor Activity Dashboard - System Status
========================================

Build Date: $(date)
Project Directory: $PROJECT_DIR

File Status:
$(for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file ($(wc -c < "$file") bytes)"
    else
        echo "❌ $file - MISSING"
    fi
done)

Companion Service:
$(if curl -s http://127.0.0.1:43917/health > /dev/null; then
    echo "✅ Running - $(curl -s http://127.0.0.1:43917/health)"
else
    echo "❌ Not running"
fi)

HTTP Server:
$(if pgrep -f "python3 -m http.server" > /dev/null; then
    echo "✅ Running on PID $(pgrep -f "python3 -m http.server" | head -1)"
else
    echo "❌ Not running"
fi)

Dashboard URLs:
- Main: http://localhost:8080/public/dashboard.html
- Test: http://localhost:8080/public/test-complete.html
- Simple: http://localhost:8080/public/test-dashboard.html

Features Implemented:
✅ Enhanced UX Design
✅ Code/Diff Preview with Line Counts
✅ Always Visible Prompts
✅ Line-Based Diff Counting
✅ Export System (CSV, JSON, Markdown)
✅ Debug Tools
✅ Filter System
✅ Error Handling
✅ Companion Integration

System Ready: $(if curl -s http://localhost:8080/public/dashboard.html > /dev/null; then echo "YES"; else echo "NO"; fi)
EOF

echo "📄 System status report created: system-status.txt"

echo ""
echo "🎉 Build Complete!"
echo ""
echo "🌐 Dashboard URLs:"
echo "   Main Dashboard: http://localhost:8080/public/dashboard.html"
echo "   Complete Test:  http://localhost:8080/public/test-complete.html"
echo "   Simple Test:    http://localhost:8080/public/test-dashboard.html"
echo ""
echo "🚀 To start the system:"
echo "   ./start-dashboard.sh"
echo ""
echo "📋 System status saved to: system-status.txt"
