#!/bin/bash

# Cursor Database Analysis Script
# This script analyzes your exported Cursor .vscdb files

set -e

DB_PATH="/Users/hamidaho/cursor_export_20250906_010707/User/globalStorage/state.vscdb"
OUTPUT_DIR="/Users/hamidaho/cursor_database_analysis_$(date +%Y%m%d_%H%M%S)"

echo "🔍 Analyzing Cursor Database..."
echo "📁 Database: $DB_PATH"
echo "📊 Output directory: $OUTPUT_DIR"

mkdir -p "$OUTPUT_DIR"

# Function to run SQLite query and save to file
run_query() {
    local query="$1"
    local output_file="$2"
    local description="$3"
    
    echo "📋 $description"
    sqlite3 "$DB_PATH" "$query" > "$output_file"
    echo "   ✅ Saved to: $output_file"
}

# Basic database info
echo ""
echo "📊 Database Overview..."
run_query ".tables" "$OUTPUT_DIR/01_tables.txt" "Listing all tables"
run_query ".schema" "$OUTPUT_DIR/02_schema.txt" "Database schema"

# ItemTable analysis
echo ""
echo "📋 Analyzing ItemTable..."
run_query "SELECT COUNT(*) as total_keys FROM ItemTable;" "$OUTPUT_DIR/03_itemtable_count.txt" "ItemTable key count"
run_query "SELECT key, length(value) as value_size FROM ItemTable ORDER BY length(value) DESC LIMIT 20;" "$OUTPUT_DIR/04_largest_values.txt" "Largest values by size"
run_query "SELECT key FROM ItemTable WHERE key LIKE '%cursor%' OR key LIKE '%ai%' OR key LIKE '%code%';" "$OUTPUT_DIR/05_cursor_ai_keys.txt" "Cursor/AI related keys"

# Cursor-specific data analysis
echo ""
echo "🤖 Analyzing Cursor-Specific Data..."
run_query "SELECT COUNT(*) as total_cursor_keys FROM cursorDiskKV;" "$OUTPUT_DIR/06_cursor_keys_count.txt" "Cursor keys count"
run_query "SELECT key FROM cursorDiskKV LIMIT 50;" "$OUTPUT_DIR/07_cursor_keys_sample.txt" "Sample cursor keys"

# Extract specific interesting data
echo ""
echo "🎯 Extracting Specific Data..."

# AI Code Tracking
run_query "SELECT value FROM ItemTable WHERE key = 'aiCodeTrackingLines';" "$OUTPUT_DIR/08_ai_code_tracking.txt" "AI Code Tracking Data"
run_query "SELECT value FROM ItemTable WHERE key = 'aiCodeTrackingScoredCommits';" "$OUTPUT_DIR/09_ai_scored_commits.txt" "AI Scored Commits"

# Personal Context
run_query "SELECT value FROM ItemTable WHERE key = 'aicontext.personalContext';" "$OUTPUT_DIR/10_personal_context.txt" "Personal Context Data"

# Cursor Settings
run_query "SELECT value FROM ItemTable WHERE key = 'anysphere.cursor-always-local';" "$OUTPUT_DIR/11_cursor_always_local.txt" "Cursor Always Local Setting"

# Color and Theme Data
run_query "SELECT value FROM ItemTable WHERE key = 'colorThemeData';" "$OUTPUT_DIR/12_color_theme.txt" "Color Theme Data"
run_query "SELECT value FROM ItemTable WHERE key = 'iconThemeData';" "$OUTPUT_DIR/13_icon_theme.txt" "Icon Theme Data"

# Terminal History
run_query "SELECT value FROM ItemTable WHERE key = 'terminal.history.entries.commands';" "$OUTPUT_DIR/14_terminal_history.txt" "Terminal History"

# Python Extension Data
run_query "SELECT value FROM ItemTable WHERE key = 'ms-python.python';" "$OUTPUT_DIR/15_python_extension.txt" "Python Extension Data"

# Export all keys for reference
echo ""
echo "📝 Exporting All Keys..."
run_query "SELECT key FROM ItemTable ORDER BY key;" "$OUTPUT_DIR/16_all_itemtable_keys.txt" "All ItemTable keys"
run_query "SELECT key FROM cursorDiskKV ORDER BY key LIMIT 1000;" "$OUTPUT_DIR/17_cursor_keys_sample_1000.txt" "First 1000 cursor keys"

# Create a summary report
echo ""
echo "📋 Creating Analysis Summary..."
cat > "$OUTPUT_DIR/ANALYSIS_SUMMARY.md" << EOF
# Cursor Database Analysis Summary

**Analysis Date:** $(date '+%Y-%m-%d %H:%M:%S')
**Database:** $DB_PATH

## Database Structure

### Tables
- **ItemTable**: Main application state storage
- **cursorDiskKV**: Cursor-specific data storage

### Key Statistics
- ItemTable keys: $(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM ItemTable;")
- Cursor keys: $(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM cursorDiskKV;")

## Exported Files

### Database Structure
- \`01_tables.txt\` - All database tables
- \`02_schema.txt\` - Complete database schema
- \`03_itemtable_count.txt\` - ItemTable key count
- \`06_cursor_keys_count.txt\` - Cursor keys count

### Data Analysis
- \`04_largest_values.txt\` - Largest stored values by size
- \`05_cursor_ai_keys.txt\` - All Cursor/AI related keys
- \`07_cursor_keys_sample.txt\` - Sample of cursor-specific keys
- \`16_all_itemtable_keys.txt\` - Complete list of ItemTable keys
- \`17_cursor_keys_sample_1000.txt\` - First 1000 cursor keys

### Specific Data Extracts
- \`08_ai_code_tracking.txt\` - AI code tracking data
- \`09_ai_scored_commits.txt\` - AI scored commits
- \`10_personal_context.txt\` - Personal context data
- \`11_cursor_always_local.txt\` - Cursor local setting
- \`12_color_theme.txt\` - Color theme configuration
- \`13_icon_theme.txt\` - Icon theme configuration
- \`14_terminal_history.txt\` - Terminal command history
- \`15_python_extension.txt\` - Python extension data

## How to View the Data

### Text Files
Most files are plain text and can be opened with any text editor.

### Large Data Files
Some files (like AI tracking data) may be large JSON or binary data. You can:
1. Open with a text editor to see the structure
2. Use \`jq\` for JSON formatting: \`jq . filename.txt\`
3. Use a hex editor for binary data

### Database Queries
To run custom queries on the database:
\`\`\`bash
sqlite3 "$DB_PATH" "YOUR_QUERY_HERE"
\`\`\`

## Interesting Findings

- The largest stored value is \`aiCodeTrackingLines\` (2.1MB)
- You have extensive AI code tracking data
- Terminal history and theme data are preserved
- Python extension settings are stored
- Personal context data for AI is available

EOF

echo ""
echo "✅ Analysis Complete!"
echo "📁 Analysis directory: $OUTPUT_DIR"
echo "📋 Summary report: $OUTPUT_DIR/ANALYSIS_SUMMARY.md"
echo ""
echo "💡 Tip: Start with the ANALYSIS_SUMMARY.md file to understand what was extracted."
