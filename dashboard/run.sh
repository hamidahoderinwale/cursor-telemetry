#!/bin/bash
# Cursor Dashboard Run Script

echo "🚀 Starting Cursor Dashboard..."

# Build first
python3 /Users/hamidaho/cursor_dashboard_builder.py build

# Open in browser
open file:///Users/hamidaho/cursor_dashboard/index.html

echo "✅ Dashboard started!"
echo "🌐 Dashboard: /Users/hamidaho/cursor_dashboard/index.html"
echo "📊 Data: /Users/hamidaho/cursor_dashboard/data.json"
echo ""
echo "💡 To rebuild: ./build.sh"
echo "💡 To watch mode: python3 /Users/hamidaho/cursor_dashboard_builder.py watch"
