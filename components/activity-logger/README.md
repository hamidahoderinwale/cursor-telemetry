# Cursor Activity Dashboard

A modern, intuitive dashboard for monitoring and visualizing all your Cursor IDE activity data.

## Features

- **Real-time Statistics** - Live counts of sessions, entries, events, and code changes
- **Smart Filtering** - Filter by source (filewatcher, clipboard, DOM, MCP) or type
- **Code Change Visualization** - Side-by-side before/after code diffs
- **Content Display** - Full prompts, responses, and notes with syntax highlighting
- **Auto-refresh** - Automatically polls companion service for new data
- **🐛 Debug Tools** - Built-in debugging and connection testing

## Quick Start

1. **Start the Companion Service** (if not already running):
   ```bash
   # In your companion service directory
   npm start
   ```

2. **Start the Dashboard**:
   ```bash
   # In the cursor-activity-logger directory
   cd public
   python3 -m http.server 8000
   ```

3. **Open the Dashboard**:
   - Go to `http://localhost:8000`
   - Click "Open Dashboard" to access the full interface

## Dashboard Interface

### Header Section
- **Statistics Cards**: Shows total sessions, entries, events, and code changes
- **Connection Status**: Real-time companion service connection indicator
- **Control Buttons**: Refresh data, debug database, test connection

### Filter Bar
- **All**: Show all activity
- **File Changes**: Show filewatcher entries with code diffs
- **Clipboard**: Show clipboard-captured content
- **DOM**: Show DOM-detected activity
- **MCP**: Show MCP service entries
- **Events**: Show system events

### Activity Feed
Each activity item shows:
- **File Path** (if applicable)
- **Activity Type** (Code Change, Conversation, Prompt, etc.)
- **Source** (filewatcher, clipboard, etc.)
- **Timestamp**
- **Full Content** (prompts, responses, code diffs)
- **Tags** (if any)

## Debug Tools

### Debug Database
Click "🐛 Debug" to see:
- Total counts in console
- All stored data
- Filewatcher entries specifically

### Test Connection
Click "🔗 Test Connection" to:
- Test companion service connectivity
- See raw data being received
- Verify data format

## Data Sources

The dashboard connects to your companion service and displays:

1. **File Changes** - Complete before/after code with file paths
2. **Clipboard Content** - Prompts and responses captured from clipboard
3. **DOM Activity** - Auto-detected interface interactions
4. **MCP Data** - Model Context Protocol entries
5. **System Events** - Logging and status events

## Modern UI Features

- **Gradient Backgrounds** - Beautiful visual design
- **Glass Morphism** - Modern frosted glass effects
- **Responsive Layout** - Works on desktop and mobile
- **Hover Effects** - Interactive card animations
- **Syntax Highlighting** - Code content with proper formatting
- **Expandable Content** - Click to see full details

## 🔄 Auto-refresh

The dashboard automatically:
- Polls the companion service every 2 seconds
- Updates statistics in real-time
- Refreshes the activity feed when new data arrives
- Maintains connection status indicators

## 🐛 Troubleshooting

### No Data Showing
1. Check companion service is running on port 43917
2. Click "Test Connection" to verify connectivity
3. Click "Debug" to see what's in the database
4. Check browser console for errors

### Connection Issues
1. Verify companion service is running
2. Check firewall settings
3. Ensure no port conflicts
4. Try refreshing the page

### Performance
- Large datasets may take a moment to load
- Use filters to narrow down displayed content
- Code diffs are limited to 300px height with scrolling

## 📁 File Structure

```
public/
├── index.html          # Landing page
├── dashboard.html      # Main dashboard interface
├── dashboard.js        # Dashboard functionality
├── app.js             # Original app (legacy)
└── style.css          # Original styles (legacy)
```

## Next Steps

The dashboard is now ready to use! It will automatically display all your Cursor activity data in a beautiful, modern interface. The companion service handles all the data capture, and the dashboard provides an intuitive way to view and explore that data.

Enjoy monitoring your Cursor activity!