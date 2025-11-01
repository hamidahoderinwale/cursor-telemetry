#!/bin/bash

# Quick test script for refactored modular dashboard

echo "=================================="
echo "Testing Refactored Dashboard"
echo "=================================="
echo ""

# Check if companion is running
if curl -s http://localhost:43917/health > /dev/null 2>&1; then
  echo "✅ Companion service is running on port 43917"
else
  echo "❌ Companion service not running!"
  echo ""
  echo "Starting companion service..."
  cd components/activity-logger/companion
  
  if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
  fi
  
  echo "🚀 Starting companion service in background..."
  nohup node src/index.js > /tmp/companion.log 2>&1 &
  COMPANION_PID=$!
  echo "   Companion PID: $COMPANION_PID"
  echo "   Waiting for service to start..."
  sleep 3
  
  if curl -s http://localhost:43917/health > /dev/null 2>&1; then
    echo "✅ Companion service started!"
  else
    echo "❌ Failed to start companion service"
    echo "   Check logs: tail -f /tmp/companion.log"
    exit 1
  fi
fi

echo ""
echo "=================================="
echo "Dashboard URL"
echo "=================================="
echo ""
echo "🌐 Open in your browser:"
echo "   http://localhost:43917/new-dashboard.html"
echo ""
echo "=================================="
echo "Testing Checklist"
echo "=================================="
echo ""
echo "1. ✅ Check Browser Console (F12):"
echo "   - Should NOT see 'redeclaration' errors"
echo "   - Should see '[SUCCESS] Dashboard initialized'"
echo "   - Should see modules loading (core/config.js, etc.)"
echo ""
echo "2. ✅ Check Network Tab (F12):"
echo "   - Verify CSS files load:"
echo "     * styles/views/navigator.css"
echo "     * styles/views/activity.css"
echo "     * styles/views/analytics.css"
echo "     * styles/views/overview.css"
echo "     * styles/views/system.css"
echo "     * styles/views/file-graph.css"
echo "   - Verify JS modules load:"
echo "     * core/config.js"
echo "     * core/state.js"
echo "     * core/api-client.js"
echo "     * utils/helpers.js"
echo "     * utils/file-helpers.js"
echo ""
echo "3. ✅ Test Each View:"
echo "   - Overview: Recent activity, system status, workspaces"
echo "   - Activity: Timeline with conversations"
echo "   - Analytics: Charts (may show 'No Data' if none yet)"
echo "   - Navigator: Semantic file visualization"
echo "   - File Graph: File relationship graph"
echo "   - System: System resources and Git/IDE state"
echo ""
echo "4. ✅ Visual Check:"
echo "   - All views should render correctly"
echo "   - No broken layouts or missing styles"
echo "   - Colors and spacing look correct"
echo ""
echo "5. ✅ Functionality:"
echo "   - Navigation between views works"
echo "   - Data loads and displays"
echo "   - Charts render (if data available)"
echo "   - Interactions work (clicks, filters, etc.)"
echo ""

# Open browser if on macOS
if [[ "$OSTYPE" == "darwin"* ]]; then
  read -p "Open dashboard in browser? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    open "http://localhost:43917/new-dashboard.html"
  fi
fi

echo ""
echo "=================================="
echo "To stop companion service:"
echo "=================================="
echo "   kill \$(lsof -ti:43917)"
echo ""

