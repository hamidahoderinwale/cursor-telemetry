# Architecture Overview - Cursor Activity Logger

This document describes the architecture and design decisions for the Cursor Activity Logger application.

## Purpose

The Cursor Activity Logger is a local, browser-based application that captures and stores development activity in real-time. It's designed to work alongside Cursor IDE (even in Private Mode) to log prompts, responses, and code context for later analysis and export.

## Architecture Layers

```
┌─────────────────────────────────────────┐
│                UI Layer                 │
│  (HTML + CSS + JavaScript SPA)         │
├─────────────────────────────────────────┤
│            Application Logic            │
│  (Session/Entry Management, Export)    │
├─────────────────────────────────────────┤
│            Data Layer                   │
│  (Dexie.js + IndexedDB)                │
├─────────────────────────────────────────┤
│            Browser Storage              │
│  (IndexedDB - Local Only)              │
└─────────────────────────────────────────┘
```

## Technology Stack

### Frontend
- **HTML5**: Semantic markup for accessibility
- **CSS3**: Modern styling with Flexbox/Grid
- **Vanilla JavaScript**: No frameworks for simplicity and performance
- **Inter Font**: Clean, readable typography

### Data Storage
- **Dexie.js**: IndexedDB wrapper for easier database operations
- **IndexedDB**: Browser-native NoSQL database
- **Local Storage Only**: No external dependencies

### Build Tools
- **None**: Pure static files, no build process required
- **CDN**: Dexie.js loaded from unpkg.com

## Core Components

### 1. Database Layer (`app.js` - Dexie Schema)

```javascript
const db = new Dexie('CursorActivityLogger');
db.version(1).stores({
    sessions: 'id, name, created_at',
    entries: '++id, session_id, timestamp, file_path, prompt, response, notes, tags'
});
```

**Responsibilities:**
- Define database schema
- Handle CRUD operations
- Manage relationships between sessions and entries
- Provide query interfaces

### 2. Session Management

**Functions:**
- `createNewSession()`: Creates new work sessions
- `updateCurrentSessionDisplay()`: Updates UI with current session info
- `renderFeed()`: Displays all sessions and entries

**State Management:**
- Global `currentSession` variable
- Session persistence across page reloads
- Automatic session selection (most recent)

### 3. Entry Management

**Functions:**
- `addEntry()`: Creates new activity entries
- `clearForm()`: Resets entry form
- `renderEntry()`: Formats individual entries for display

**Validation:**
- Requires active session
- Validates required fields (prompt or response)
- Handles optional fields gracefully

### 4. Export System

**Functions:**
- `exportCSV()`: Exports flat CSV format
- `exportJSON()`: Exports structured JSON format
- `downloadFile()`: Handles browser download

**Export Formats:**
- **CSV**: Flat table with all entry data
- **JSON**: Hierarchical structure with sessions and entries

### 5. UI Components

**HTML Structure:**
- Header with session controls
- Entry form with validation
- Activity feed with chronological display
- Export controls

**CSS Architecture:**
- Mobile-first responsive design
- Component-based styling
- Minimal, distraction-free interface

## Data Flow

### 1. Session Creation
```
User clicks "Start New Session" 
→ Prompt for session name 
→ Create session record in DB 
→ Set as current session 
→ Update UI display
```

### 2. Entry Addition
```
User fills form and clicks "Add Entry" 
→ Validate current session exists 
→ Validate form data 
→ Create entry record in DB 
→ Clear form 
→ Refresh feed display
```

### 3. Feed Rendering
```
Load all sessions (chronological) 
→ For each session, load entries (chronological) 
→ Render HTML structure 
→ Display in feed container
```

### 4. Export Process
```
User clicks export button 
→ Query all sessions and entries 
→ Transform data to target format 
→ Create downloadable file 
→ Trigger browser download
```

## State Management

### Global State
- `currentSession`: Currently active session object
- `elements`: Cached DOM element references

### Local State
- Form field values (managed by DOM)
- UI display state (managed by CSS classes)
- Database state (managed by Dexie)

### State Persistence
- Sessions and entries persist in IndexedDB
- Current session persists across page reloads
- No server-side state synchronization

## Error Handling

### Database Errors
- Try-catch blocks around all DB operations
- User-friendly error notifications
- Graceful degradation for missing data

### Validation Errors
- Form validation before submission
- Clear error messages for users
- Prevention of invalid data entry

### Network Independence
- No external API calls
- Works completely offline
- No network error handling needed

## Performance Considerations

### Database Queries
- Indexed queries for fast lookups
- Pagination for large datasets (future enhancement)
- Efficient relationship queries

### UI Rendering
- DOM element caching
- Minimal re-renders
- Efficient string concatenation

### Memory Management
- No memory leaks from event listeners
- Proper cleanup of object URLs
- Efficient data structures

## Security Considerations

### Data Privacy
- All data stored locally
- No external data transmission
- User controls all data access

### Input Sanitization
- Basic HTML escaping in display
- No script injection vulnerabilities
- Safe file download handling

### Browser Security
- Same-origin policy compliance
- No cross-site scripting risks
- Secure IndexedDB usage

## Browser Compatibility

### Supported Browsers
- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

### Required Features
- IndexedDB support
- ES6+ JavaScript features
- CSS Grid/Flexbox support
- Blob API for downloads

## Deployment

### File Structure
```
cursor-activity-logger/
├── public/
│   ├── index.html
│   ├── style.css
│   └── app.js
├── schema/
│   └── SCHEMA.md
└── docs/
    ├── ARCHITECTURE.md
    └── QUICKSTART.md
```

### Hosting Options
- Static file hosting (GitHub Pages, Netlify, Vercel)
- Local file system (file:// protocol)
- Any web server serving static files

### No Build Process
- Direct browser execution
- No compilation or bundling
- Immediate deployment

## Future Enhancements

### Planned Features
- Full-text search across entries
- Code diff tracking
- File attachment support
- Multi-user collaboration
- Data synchronization

### Architecture Considerations
- Modular component system
- Plugin architecture for extensions
- API layer for external integrations
- Progressive Web App features

## Maintenance

### Code Organization
- Single-file JavaScript (for simplicity)
- Clear function separation
- Comprehensive comments
- Consistent naming conventions

### Documentation
- Inline code comments
- External documentation files
- Schema documentation
- Usage examples

### Testing Strategy
- Manual testing of core features
- Browser compatibility testing
- Data integrity validation
- Export format verification
