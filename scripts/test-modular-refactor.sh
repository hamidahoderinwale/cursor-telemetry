#!/bin/bash

# Test script for modular-refactor branch
# This script helps you test the refactored dashboard

echo "=================================="
echo "Testing Modular Refactor Branch"
echo "=================================="
echo ""

# Check if we're on the right branch
BRANCH=$(cd cursor-telemetry && git branch --show-current)
if [ "$BRANCH" != "feature/modular-refactor" ]; then
  echo "⚠️  WARNING: Not on feature/modular-refactor branch (currently on: $BRANCH)"
  echo "   Switching to feature/modular-refactor..."
  cd cursor-telemetry && git checkout feature/modular-refactor
else
  echo "✅ On feature/modular-refactor branch"
fi

echo ""
echo "Checking companion service..."
cd cursor-telemetry/components/activity-logger/companion

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
fi

# Check if companion is running
if lsof -ti:43917 > /dev/null 2>&1; then
  echo "✅ Companion service is already running on port 43917"
else
  echo "🚀 Starting companion service..."
  echo ""
  echo "Starting in background..."
  nohup node src/index.js > /tmp/companion.log 2>&1 &
  COMPANION_PID=$!
  echo "   Companion PID: $COMPANION_PID"
  echo "   Logs: tail -f /tmp/companion.log"
  sleep 3
  
  if lsof -ti:43917 > /dev/null 2>&1; then
    echo "✅ Companion service started successfully"
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
echo "Or if using file:// protocol:"
echo "   file://$(pwd)/cursor-telemetry/components/activity-logger/public/new-dashboard.html"
echo ""
echo "=================================="
echo "Testing Checklist"
echo "=================================="
echo ""
echo "1. ✅ Verify CSS is loading:"
echo "   - Open browser DevTools (F12)"
echo "   - Check Network tab for CSS files:"
echo "     * styles/views/navigator.css"
echo "     * styles/views/activity.css"
echo "     * styles/views/analytics.css"
echo "     * styles/views/overview.css"
echo "     * styles/views/system.css"
echo "     * styles/views/file-graph.css"
echo ""
echo "2. ✅ Verify modules are loading:"
echo "   - Check Network tab for JS files:"
echo "     * core/config.js"
echo "     * core/state.js"
echo "     * core/api-client.js"
echo "     * utils/helpers.js"
echo "     * utils/file-helpers.js"
echo ""
echo "3. ✅ Test each view:"
echo "   - Overview: Should show recent activity, system status, workspaces"
echo "   - Activity: Should show timeline with conversations"
echo "   - Analytics: Should show charts (check for 'No Data' if no data yet)"
echo "   - Navigator: Should show semantic file visualization"
echo "   - File Graph: Should show file relationship graph"
echo "   - System: Should show system resources and Git/IDE state"
echo ""
echo "4. ✅ Verify no console errors:"
echo "   - Check browser Console (F12)"
echo "   - Should see initialization messages"
echo "   - Should NOT see CSS/styling errors"
echo ""
echo "5. ✅ Check styling:"
echo "   - All views should have proper spacing and colors"
echo "   - No inline styles visible in Elements inspector"
echo "   - CSS classes should be used instead"
echo ""
echo "=================================="
echo "To stop companion service:"
echo "=================================="
echo "   kill \$(lsof -ti:43917)"
echo ""

# Open browser if on macOS
if [[ "$OSTYPE" == "darwin"* ]]; then
  read -p "Open dashboard in browser? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    open "http://localhost:43917/new-dashboard.html"
  fi
fi

