#!/bin/bash

# Cursor Data Export Script
# This script exports all your Cursor IDE data for backup or migration purposes

set -e

# Configuration
CURSOR_DATA_DIR="/Users/hamidaho/Library/Application Support/Cursor"
EXPORT_DIR="/Users/hamidaho/cursor_export_$(date +%Y%m%d_%H%M%S)"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

echo "🚀 Starting Cursor Data Export at $TIMESTAMP"
echo "📁 Export directory: $EXPORT_DIR"

# Create export directory
mkdir -p "$EXPORT_DIR"

# Function to safely copy files
safe_copy() {
    local source="$1"
    local dest="$2"
    if [ -e "$source" ]; then
        echo "📋 Copying: $source"
        cp -r "$source" "$dest" 2>/dev/null || echo "⚠️  Warning: Could not copy $source"
    else
        echo "⚠️  Not found: $source"
    fi
}

# Export core user data
echo ""
echo "📊 Exporting Core User Data..."
mkdir -p "$EXPORT_DIR/User"
safe_copy "$CURSOR_DATA_DIR/User/settings.json" "$EXPORT_DIR/User/"
safe_copy "$CURSOR_DATA_DIR/User/keybindings.json" "$EXPORT_DIR/User/"
safe_copy "$CURSOR_DATA_DIR/User/snippets" "$EXPORT_DIR/User/"

# Export workspace storage (project-specific settings)
echo ""
echo "📁 Exporting Workspace Storage..."
mkdir -p "$EXPORT_DIR/User/workspaceStorage"
safe_copy "$CURSOR_DATA_DIR/User/workspaceStorage" "$EXPORT_DIR/User/"

# Export global storage (extensions, state)
echo ""
echo "🌐 Exporting Global Storage..."
mkdir -p "$EXPORT_DIR/User/globalStorage"
safe_copy "$CURSOR_DATA_DIR/User/globalStorage/storage.json" "$EXPORT_DIR/User/globalStorage/"
safe_copy "$CURSOR_DATA_DIR/User/globalStorage/state.vscdb" "$EXPORT_DIR/User/globalStorage/"
safe_copy "$CURSOR_DATA_DIR/User/globalStorage/state.vscdb.backup" "$EXPORT_DIR/User/globalStorage/"

# Export extension data
echo ""
echo "🔌 Exporting Extension Data..."
mkdir -p "$EXPORT_DIR/User/globalStorage/extensions"
if [ -d "$CURSOR_DATA_DIR/User/globalStorage/ms-toolsai.jupyter" ]; then
    safe_copy "$CURSOR_DATA_DIR/User/globalStorage/ms-toolsai.jupyter" "$EXPORT_DIR/User/globalStorage/"
fi

# Export history (recent files, workspaces)
echo ""
echo "📚 Exporting History..."
mkdir -p "$EXPORT_DIR/User/History"
safe_copy "$CURSOR_DATA_DIR/User/History" "$EXPORT_DIR/User/"

# Export application preferences
echo ""
echo "⚙️  Exporting Application Preferences..."
mkdir -p "$EXPORT_DIR/AppData"
safe_copy "$CURSOR_DATA_DIR/Preferences" "$EXPORT_DIR/AppData/"
safe_copy "$CURSOR_DATA_DIR/languagepacks.json" "$EXPORT_DIR/AppData/"

# Export logs (optional - can be large)
echo ""
echo "📝 Exporting Logs..."
mkdir -p "$EXPORT_DIR/logs"
safe_copy "$CURSOR_DATA_DIR/logs" "$EXPORT_DIR/"

# Create a summary report
echo ""
echo "📋 Creating Export Summary..."
cat > "$EXPORT_DIR/EXPORT_SUMMARY.md" << EOF
# Cursor Data Export Summary

**Export Date:** $TIMESTAMP
**Source Directory:** $CURSOR_DATA_DIR
**Export Directory:** $EXPORT_DIR

## Exported Data

### Core User Data
- ✅ Settings (settings.json)
- ✅ Keybindings (keybindings.json)
- ✅ Code Snippets
- ✅ Workspace Storage (project-specific settings)
- ✅ Global Storage (extensions, state)
- ✅ File History
- ✅ Application Preferences

### Database Files
- ✅ state.vscdb (main state database)
- ✅ state.vscdb.backup (backup state database)
- ✅ storage.json (extension storage)

### Optional Data
- ✅ Logs (may be large)

## Restoration Instructions

To restore this data to a new Cursor installation:

1. Close Cursor completely
2. Navigate to the new Cursor data directory:
   - macOS: \`~/Library/Application Support/Cursor/User/\`
   - Windows: \`%APPDATA%\\Cursor\\User\\\`
   - Linux: \`~/.config/Cursor/User/\`

3. Copy the exported files to the corresponding locations
4. Restart Cursor

## File Sizes
EOF

# Calculate and display file sizes
echo ""
echo "📊 Calculating Export Sizes..."
du -sh "$EXPORT_DIR"/* >> "$EXPORT_DIR/EXPORT_SUMMARY.md" 2>/dev/null || true

# Create a compressed archive
echo ""
echo "🗜️  Creating Compressed Archive..."
cd "$(dirname "$EXPORT_DIR")"
tar -czf "cursor_export_$(date +%Y%m%d_%H%M%S).tar.gz" "$(basename "$EXPORT_DIR")"

echo ""
echo "✅ Export Complete!"
echo "📁 Export directory: $EXPORT_DIR"
echo "📦 Compressed archive: $(dirname "$EXPORT_DIR")/cursor_export_$(date +%Y%m%d_%H%M%S).tar.gz"
echo "📋 Summary report: $EXPORT_DIR/EXPORT_SUMMARY.md"
echo ""
echo "💡 Tip: The compressed archive is ready for backup or transfer to another machine."
