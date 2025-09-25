# Quick Start Guide - Cursor Activity Logger

Get up and running with the Cursor Activity Logger in minutes.

## What is this?

The Cursor Activity Logger is a local, browser-based tool that helps you capture and organize your development activity. It works alongside Cursor IDE (even in Private Mode) to log prompts, responses, and code context for later analysis.

## Features

- ✅ **Auto-Logging via Clipboard**: Automatically capture copied prompts and responses
- ✅ **Smart Text Parsing**: Intelligently splits copied content into prompts and responses
- ✅ **Session Organization**: Group related activities into sessions
- ✅ **Local Storage**: All data stays on your machine
- ✅ **Export Options**: Download your data as CSV or JSON
- ✅ **Private Mode Compatible**: Works even when Cursor's telemetry is disabled
- ✅ **No Setup Required**: Just open the HTML file in your browser

## Getting Started

### Option 1: Open Directly in Browser

1. Navigate to the `cursor-activity-logger` folder
2. Open `public/index.html` in your web browser
3. Start logging your activity!

### Option 2: Serve with Local Web Server

```bash
# Using Python (if installed)
cd cursor-activity-logger/public
python -m http.server 8000

# Using Node.js (if installed)
cd cursor-activity-logger/public
npx serve .

# Using PHP (if installed)
cd cursor-activity-logger/public
php -S localhost:8000
```

Then open `http://localhost:8000` in your browser.

## Basic Usage

### 1. Start a New Session

1. Click "Start New Session" button
2. Enter a descriptive name (e.g., "Bug Fix - Login Issue")
3. Click OK
4. Auto-logging will start automatically

### 2. Auto-Log Activity (Recommended)

1. **Enable Auto-Logging**: Click "Toggle Auto-Logging" if not already active
2. **Copy Content**: Copy prompts and responses from Cursor
3. **Automatic Logging**: Content is automatically parsed and logged
4. **Status Indicator**: Green dot shows when auto-logging is active

### 3. View Your Activity

- All sessions and entries appear in the Activity Feed
- Sessions are ordered by creation date (newest first)
- Entries within each session are ordered by timestamp
- Auto-logged entries are marked with "auto-logged" tag

### 4. Export Your Data

- **CSV Export**: Download a flat table of all entries
- **JSON Export**: Download structured data with sessions and entries
- **Clear Database**: Remove all data (use with caution!)

## Tips for Effective Use

### Session Naming
- Use descriptive names: "Feature: User Authentication"
- Include dates: "Bug Fix - 2024-01-15"
- Be specific: "Refactor: Payment Processing Module"

### Auto-Logging Tips
- Copy complete prompt/response pairs for best parsing
- The app automatically detects file paths in copied text
- Auto-logged entries are tagged with "auto-logged"
- The app intelligently parses various text formats

### Entry Organization
- File paths are automatically extracted from copied text
- Auto-logged entries are tagged with "auto-logged"
- Entries are organized by session and timestamp
- Use descriptive session names for better organization

### Keyboard Shortcuts
- **Copy**: Automatically logs content when auto-logging is active

## Data Privacy

- ✅ All data is stored locally in your browser
- ✅ No data is sent to external servers
- ✅ No network connection required
- ✅ You have complete control over your data

## Troubleshooting

### App Won't Load
- Make sure you're opening `index.html` in a modern browser
- Check browser console for JavaScript errors
- Try refreshing the page

### Data Not Saving
- Ensure your browser supports IndexedDB
- Check if you have sufficient storage space
- Try clearing browser cache and reloading

### Export Not Working
- Make sure you have data to export (create a session and entry first)
- Check if your browser allows downloads
- Try a different browser if issues persist

### Performance Issues
- Large amounts of data may slow down the interface
- Use the "Clear Database" button to reset if needed
- Consider exporting and clearing old data periodically

## Browser Compatibility

### Supported Browsers
- Chrome 60+ ✅
- Firefox 55+ ✅
- Safari 12+ ✅
- Edge 79+ ✅

### Required Features
- IndexedDB support
- ES6+ JavaScript
- CSS Grid/Flexbox
- Blob API for downloads

## File Structure

```
cursor-activity-logger/
├── public/
│   ├── index.html          # Main application
│   ├── style.css           # Styling
│   └── app.js              # Application logic
├── schema/
│   └── SCHEMA.md           # Database schema docs
├── docs/
│   ├── ARCHITECTURE.md     # Technical architecture
│   └── QUICKSTART.md       # This file
└── README.md               # Project overview
```

## Getting Help

### Common Issues
1. **"Please start a new session first"**: Click "Start New Session" before adding entries
2. **Empty feed**: Create a session and add some entries
3. **Export not working**: Make sure you have data to export

### Data Recovery
- Data is stored in your browser's IndexedDB
- Clearing browser data will remove all logged activity
- Export your data regularly to avoid data loss

## Advanced Usage

### Batch Entry Addition
- Use the form to quickly log multiple related entries
- Clear form fields between entries for efficiency
- Use consistent tags for easy filtering later

### Data Analysis
- Export to CSV for spreadsheet analysis
- Export to JSON for programmatic processing
- Use tags to categorize and filter activities

### Integration with Cursor
- Keep the logger open in a separate browser tab
- Copy prompts and responses from Cursor to the logger
- Use file paths to track which files you're working on

## Next Steps

Once you're comfortable with basic usage, explore:
- The database schema documentation (`schema/SCHEMA.md`)
- The technical architecture (`docs/ARCHITECTURE.md`)
- Advanced export and data management features

Happy logging! 🚀
