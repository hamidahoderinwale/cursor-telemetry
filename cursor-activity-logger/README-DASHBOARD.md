# 🎯 Cursor Activity Dashboard

A comprehensive dashboard for tracking and analyzing Cursor AI interactions with enhanced UX design, code diff visualization, and export capabilities.

## ✨ Features

### 🎨 Enhanced UX Design
- **Hierarchical Card Structure**: Clean header, metadata, tags, and content sections
- **Compact Event Cards**: Event icons with detailed information display
- **Minimal Design Language**: Sharp, dense, grayscale aesthetic maintained
- **Responsive Layout**: Works on all screen sizes

### 📊 Code Diff Visualization
- **Side-by-Side Preview**: Before/After code comparison above notes
- **Line-Based Diff Counting**: Shows both line changes and character counts
- **Format**: `+5 lines (+150 chars)` or `+150 chars` (if no line changes)
- **Full Diff Modal**: Click "View Full Diff" for complete comparison

### 💬 Always Visible Prompts
- **Immediate Display**: Prompts show without clicking
- **Enhanced Styling**: 
  - Prompts: Light blue background with blue left border
  - Responses: Light green background with green left border
- **Italic Text**: Prompts are italicized for distinction

### 🔍 Advanced Filtering
- **Source Filters**: File Changes, Clipboard, DOM, MCP
- **Session Filters**: Filter by specific sessions
- **Tag Filters**: Filter by activity tags
- **Event Type Filters**: Filter by event types

### 📤 Export Capabilities
- **CSV Export**: Comprehensive data with statistics
- **JSON Export**: Complete database with metadata
- **Markdown Export**: Human-readable format with session grouping

### 🐛 Debug Tools
- **Database Inspector**: View raw database contents
- **Prompt Debugger**: Analyze prompt data and visibility
- **Companion Tester**: Test companion service connection
- **Export Tester**: Verify export functionality

## 🚀 Quick Start

### Option 1: Use the Launcher Script
```bash
cd /Users/hamidaho/Desktop/cursor_dashboard/cursor-activity-logger
./start-dashboard.sh
```

### Option 2: Manual Start
```bash
cd /Users/hamidaho/Desktop/cursor_dashboard/cursor-activity-logger
python3 -m http.server 8080
```

Then open: http://localhost:8080/public/dashboard.html

## 🌐 Available URLs

- **Main Dashboard**: http://localhost:8080/public/dashboard.html
- **Complete Test**: http://localhost:8080/public/test-complete.html
- **Simple Test**: http://localhost:8080/public/test-dashboard.html

## 🔧 System Components

### Frontend (Dashboard)
- **HTML**: `public/dashboard.html` - Main dashboard interface
- **CSS**: `public/dashboard.css` - Complete styling system
- **JavaScript**: `public/app.js` - All functionality and interactions

### Backend (Companion Service)
- **Queue Service**: `companion/src/queue.js` - Data collection and API
- **Port**: 43917 - Companion service endpoint
- **Health Check**: http://127.0.0.1:43917/health

### Database
- **Type**: IndexedDB (Dexie.js)
- **Tables**: sessions, entries, events, attachments
- **Search**: MiniSearch integration for full-text search

## 📊 Data Flow

1. **Companion Service** collects data from Cursor
2. **Dashboard** polls companion service every 2 seconds
3. **Data** is stored in IndexedDB for persistence
4. **UI** renders data with enhanced visualizations
5. **Exports** provide data in multiple formats

## 🎯 Key Improvements Made

### Visual Enhancements
- ✅ Code preview with line counts
- ✅ Always visible prompts and responses
- ✅ Enhanced diff display (lines + characters)
- ✅ Clean card hierarchy and spacing
- ✅ Improved color coding and typography

### Functionality Improvements
- ✅ Better error handling for companion service
- ✅ Smart diff counting and display
- ✅ Enhanced export capabilities
- ✅ Comprehensive debug tools
- ✅ Improved filter system

### Technical Improvements
- ✅ Added MiniSearch library for search
- ✅ Fixed missing DOM element references
- ✅ Improved companion polling with timeouts
- ✅ Better error classification and handling
- ✅ Enhanced code organization

## 🐛 Troubleshooting

### Server Issues
If you get "Address already in use" errors:
```bash
pkill -f "python3 -m http.server"
python3 -m http.server 8080
```

### Companion Service Issues
If companion service isn't running:
- Dashboard will work in browser-only mode
- Use debug tools to inspect data
- Check companion service logs

### Browser Issues
If browser won't open URLs:
- Copy/paste URLs manually
- Try different browsers
- Check firewall settings

## 📈 Current Status

- ✅ **Dashboard**: Fully functional with enhanced UX
- ✅ **Companion Service**: Running with 90+ entries/events
- ✅ **Code Previews**: Side-by-side with line counts
- ✅ **Prompt Visibility**: Always visible with enhanced styling
- ✅ **Diff Analysis**: Line and character-based tracking
- ✅ **Export System**: CSV, JSON, and Markdown formats
- ✅ **Debug Tools**: Comprehensive testing and inspection
- ✅ **Error Handling**: Graceful companion service management

## 🎉 Ready to Use!

The Cursor Activity Dashboard is now fully functional with all requested features implemented. The system provides comprehensive tracking, visualization, and analysis of Cursor AI interactions with a clean, professional interface.
