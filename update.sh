#!/bin/bash
# Cursor Dashboard Update Script

echo "🔄 Updating Cursor Dashboard..."

# Extract fresh data
python3 /Users/hamidaho/cursor_dashboard/scripts/cursor_dashboard_builder.py update

echo "✅ Dashboard updated!"
echo "🕐 Last updated: $(date)"
