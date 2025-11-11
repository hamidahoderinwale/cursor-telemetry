#!/bin/bash

# Install PKL Memory Extension for Cursor
echo "Installing PKL Memory Extension for Cursor..."

# Create extension directory
EXTENSION_DIR="$HOME/.cursor/extensions/pkl-memory-extension"
mkdir -p "$EXTENSION_DIR"

# Copy extension files
cp -r components/dashboard/src/cursor-extension/* "$EXTENSION_DIR/"

# Install dependencies
cd "$EXTENSION_DIR"
npm install

# Compile TypeScript
npm run compile

echo "PKL Memory Extension installed successfully!"
echo "Restart Cursor to activate the extension."
echo ""
echo "After restarting Cursor:"
echo "1. Open the Explorer panel"
echo "2. Look for 'PKL Memories' in the sidebar"
echo "3. Or use Command Palette (Cmd+Shift+P) and search for 'PKL Memory'"
