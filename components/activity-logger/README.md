# Cursor Telemetry Dashboard

> **APPLICATION 2: Full Visualization & Analytics Interface**
> 
> This is the **complete dashboard** - a web-based interface for visualizing and analyzing your development data. **Requires the companion service to function.**

---

## What You Get

**Everything from Companion Service**
- All backend features and APIs
- Real-time data capture
- Historical mining
- Export capabilities

**Plus: Beautiful Web Interface**
- 20+ visualization views
- Real-time updates
- Interactive charts and graphs
- D3.js network visualizations

**Plus: AI-Powered Features**
- Event annotations with descriptions
- Natural language interface
- Semantic search
- State management with visual graph

**Plus: Advanced Analytics**
- Productivity metrics
- Context usage tracking
- Error analysis
- File dependency graphs

---

## Quick Start

### Prerequisites
- Everything from [Companion Service](companion/README.md)
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Installation

```bash
# 1. Navigate to companion directory
cd cursor-telemetry/components/activity-logger/companion

# 2. Install dependencies (if not already done)
npm install

# 3. Start the service
node src/index.js
```

### Access Dashboard

Open your browser to:
```
http://localhost:43917/dashboard.html
```

The dashboard is automatically served by the companion service.

---

## Dashboard Views

### Overview
- Real-time activity statistics
- Recent file changes
- Latest AI prompts
- Quick workspace selector
- System health status

### Activity
- Complete timeline of all events
- AI-generated annotations
- Intent badges (feature, bug-fix, refactor)
- Filter by type, workspace, date
- Search across all events
- Conversation threading

### Analytics
- **Productivity Metrics:**
  - Events per hour/day
  - Active coding time
  - Peak productivity hours
- **Context Window Usage:**
  - Token usage over time
  - Context window fills
  - Average tokens per prompt
- **Error Tracking:**
  - Error frequency
  - Error types distribution
  - Time-to-resolution

### File Graph
- Interactive D3.js visualization
- File dependency network
- Color-coded by file type
- Similarity-based clustering
- Zoom and pan controls
- Click to explore relationships

### Module Graph
- High-level architecture view
- Module dependencies
- Import/export relationships
- Privacy-preserving abstraction

### States
- Visual state management
- Fork/merge workflows
- State graph visualization
- Natural language commands
- State recommendations

### Navigator
- Workspace file explorer
- File type distribution
- Size analysis
- Quick file access

### System
- CPU usage monitoring
- Memory tracking
- Load average
- IDE state information

### Historical Mining
- Mine git commit history
- Extract shell commands
- Parse Cursor logs
- Reconstruct file timeline
- View mining statistics

### Rungs (Privacy Levels)
- **Clio (Motifs):** Workflow patterns
- **Module Graph:** File dependencies
- **Rung 3:** Function-level changes
- **Rung 2:** Semantic edit scripts
- **Rung 1:** Token-level with PII redaction

### Threads
- Conversation visualization
- Prompt-response chains
- Context tracking

### Todos
- Task tracking
- Development workflow

### Whiteboard
- Visual workspace
- Note-taking
- Diagrams

### API Docs
- Complete API reference
- Interactive examples
- Request/response formats

---

## Key Features

### AI-Powered Annotations

Events are automatically annotated with AI-generated descriptions:

**Example:**
- **Raw event:** `file_change: auth.js`
- **AI annotation:** "Added JWT token validation middleware with expiration checking"
- **Intent:** `feature`

**How it works:**
1. File change detected
2. Sent to OpenRouter API with context
3. AI generates semantic description
4. Intent automatically classified
5. Displayed with icon in timeline

### Natural Language Interface

Control your workflow with plain English:

**Command Palette (Cmd+K):**
```
Fork a state for trying authentication
Show me states where I was fixing the login bug
Find states where I was working on API endpoints
Merge the performance optimization into main
```

**How it works:**
1. Parse command with AI + rules
2. Extract action, intent, topic
3. Execute appropriate API call
4. Show results in UI

### Multi-Layer Search

Three search modes:

1. **Full-text Search (Lunr.js)**
   - Fast exact matches
   - Keyword-based

2. **Semantic Search (Embeddings)**
   - Find by meaning
   - "Authentication implementation" matches "JWT token handling"

3. **Fuzzy Search**
   - Typo-tolerant
   - Partial matches

### Visual State Management

**State Graph:**
- D3.js force-directed layout
- Color-coded by intent
- Interactive (click, drag, zoom)
- Shows fork/merge relationships

**State Timeline:**
- State transitions in activity feed
- Visual boundary markers
- Color-coded borders

**State Operations:**
- **Fork:** Create experimental branches
- **Merge:** Combine work into main state
- **Diff:** Compare two states
- **Recommendations:** AI suggests related states

### Workspace Sharing

Create secure, shareable links:

**Features:**
- Privacy level controls (4 levels)
- Automatic expiration (1 day to 1 year)
- Date range filtering
- Custom names
- Real-time preview
- Link management

**How to Use:**
1. Click "Share Workspace" in sidebar
2. Select workspaces
3. Choose privacy level
4. Set expiration
5. Review preview
6. Create link
7. Share URL with others

**Privacy Levels:**
- **Level 0:** Full code traces (trusted only)
- **Level 1:** Code abstracts (recommended)
- **Level 2:** Statement-level (high privacy)
- **Level 3:** Workflow patterns (maximum privacy)

---

## Performance Optimizations

### Background Preloading
Heavy data (file graph, similarities) precomputed in background while UI renders.

### Smart Caching
- `sessionStorage` for precomputed data (10-minute expiry)
- Instant re-renders on view changes
- No re-computation needed

### Progressive Rendering
- Basic UI loads immediately
- Analytics load progressively
- No blocking operations

### Web Workers
- Heavy computations offloaded
- UI remains responsive
- Background processing

### Optimized Algorithms
- Barnes-Hut for force-directed layouts
- kNN sampling for large datasets
- Debounced search inputs
- Virtualized lists for large datasets

---

## Customization

### Theme
The dashboard respects system preferences:
- Light mode
- Dark mode (auto-detected)

### Layout
- Resizable panels
- Collapsible sidebars
- Customizable view order

### Filters
Save filter preferences:
- Workspace filters
- Date ranges
- Event types
- Intent filters

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+K` / `Ctrl+K` | Open command palette |
| `Cmd+/` / `Ctrl+/` | Open search |
| `Esc` | Close modal/palette |
| Arrow keys | Navigate timeline |
| `Space` | Pause/resume real-time updates |

---

## Architecture

```
Dashboard (Frontend)
├── Entry Point
│   └── dashboard.html
├── Core
│   ├── view-router.js (SPA routing)
│   ├── api-client.js (HTTP + WebSocket)
│   ├── state.js (global state)
│   └── websocket-manager.js (real-time)
├── Views (20+ pages)
│   ├── overview/
│   ├── activity/
│   ├── analytics/
│   ├── file-graph/
│   ├── module-graph/
│   ├── states/
│   ├── navigator/
│   ├── system/
│   ├── historical-mining/
│   ├── tokens/
│   ├── semantic-edits/
│   ├── functions/
│   └── clio/
├── Components
│   ├── charts/ (Chart.js wrappers)
│   ├── modals/ (modal system)
│   └── shared/ (reusable components)
├── Services
│   ├── annotation-service.js
│   ├── state-service.js
│   ├── analytics/ (metrics)
│   └── search/ (multi-layer search)
├── Utils
│   ├── formatting/
│   ├── performance/
│   ├── timeline/
│   └── workers/
└── Visualizations
    ├── D3.js (file graph, state graph)
    ├── Chart.js (analytics)
    └── Custom SVG (timelines)
```

---

## Tech Stack

### Core Technologies
- **Vanilla JavaScript** - No framework, fast and lightweight
- **HTML5 + CSS3** - Modern web standards
- **WebSocket** - Real-time updates via Socket.IO

### Visualization Libraries
- **D3.js v6** - Network graphs, force layouts
- **Chart.js** - Analytics charts
- **Lucide Icons** - Modern icon set

### Search & AI
- **Lunr.js** - Full-text search
- **OpenRouter API** - Embeddings and chat
- **Web Workers** - Background processing

### Performance
- **sessionStorage** - Client-side caching
- **Web Workers** - CPU-intensive tasks
- **Service Worker** - Offline support (optional)

---

## Data Flow

```
User Action
    ↓
Dashboard UI
    ↓
API Client (fetch/WebSocket)
    ↓
Companion Service (Express API)
    ↓
SQLite Database
    ↓
Response
    ↓
UI Update (real-time via WebSocket)
```

---

## Development

### Adding New Views

1. Create view directory:
```bash
mkdir public/views/my-view
```

2. Create files:
```
my-view/
├── index.js          # View logic
├── templates.js      # HTML templates
└── styles.css        # View-specific styles
```

3. Register in `core/view-router.js`:
```javascript
const viewFunctionNames = {
  'my-view': 'renderMyView',
  // ...
};
```

4. Add navigation link in `dashboard.html`:
```html
<a href="#my-view" class="nav-link" data-view="my-view">
  <svg>...</svg>
  My View
</a>
```

5. Load scripts in `dashboard.html`:
```html
<script src="views/my-view/templates.js" defer></script>
<script src="views/my-view/index.js" defer></script>
<link rel="stylesheet" href="views/my-view/styles.css">
```

### Adding New API Integrations

1. Add to `services/`:
```javascript
// services/my-service.js
class MyService {
  constructor(apiBase) {
    this.apiBase = apiBase;
  }
  
  async fetchData() {
    const response = await fetch(`${this.apiBase}/api/my-endpoint`);
    return response.json();
  }
}
```

2. Initialize in view:
```javascript
const myService = new MyService(window.CONFIG.API_BASE);
const data = await myService.fetchData();
```

---

## Troubleshooting

### Dashboard Not Loading

```bash
# 1. Verify companion service is running
curl http://localhost:43917/health

# 2. Check if dashboard.html exists
ls -la public/dashboard.html

# 3. Check browser console (F12)
# Look for JavaScript errors
```

### Real-Time Updates Not Working

```bash
# 1. Check WebSocket connection
# Open browser console (F12), look for:
# "WebSocket connected" message

# 2. Verify Socket.IO is working
curl http://localhost:43917/socket.io/

# 3. Check CORS settings
# If accessing from different domain
```

### Visualizations Not Rendering

```bash
# 1. Check if D3.js loaded
# Browser console: typeof d3
# Should return: "object"

# 2. Check if Chart.js loaded
# Browser console: typeof Chart
# Should return: "function"

# 3. Clear browser cache
# Ctrl+Shift+R (hard reload)
```

### AI Features Not Working

```bash
# 1. Verify OpenRouter API key in companion
curl http://localhost:43917/api/ai/status

# 2. Check browser console for errors
# Look for API key errors

# 3. Verify AI service is enabled
cat companion/config.json
```

---

## Browser Compatibility

| Browser | Version | Support |
|---------|---------|---------|
| Chrome | 90+ | Full |
| Firefox | 88+ | Full |
| Safari | 14+ | Full |
| Edge | 90+ | Full |
| Opera | 76+ | Full |

**Requirements:**
- ES6+ support
- WebSocket support
- CSS Grid support
- SVG support

---

## Deployment Options

### Local Development
```bash
# Already included with companion service
node src/index.js
# Access at http://localhost:43917/dashboard.html
```

### Static Hosting (Netlify/Vercel)
```bash
# Deploy public/ directory separately
# Point API_BASE to your deployed companion service

# netlify.toml included
# vercel.json included
```

### Docker
```bash
# Dashboard is included in companion Docker image
docker run -d -p 43917:43917 cursor-companion
```

---

## Related Documentation

- [Main README](../../README.md) - Project overview and deployment options
- [Companion Service README](companion/README.md) - Backend API reference
- [Database Schema](../../docs/DATABASE_SCHEMA.json) - Complete schema
- [Data Types](../../docs/DATA_TYPES.json) - Privacy levels & rungs

---

## Support

- Issues: https://github.com/hamidahoderinwale/cursor-telemetry/issues
- API Docs: http://localhost:43917/dashboard.html#api-docs
- Discussions: https://github.com/hamidahoderinwale/cursor-telemetry/discussions
