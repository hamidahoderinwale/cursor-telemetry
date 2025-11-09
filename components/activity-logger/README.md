# Cursor Activity Dashboard

A modern, intelligent dashboard for monitoring and visualizing all your Cursor IDE activity data with AI-powered annotations, natural language state management, and comprehensive analytics.

## Features

### AI-Powered Features
- **Event Annotations** - Automatic AI-generated descriptions (e.g., "Added authentication middleware" instead of "file changed")
- **Intent Classification** - Automatically tags events as `feature`, `bug-fix`, `refactor`, `experiment`, etc.
- **State Summarization** - Generates summaries when creating development states
- **Natural Language Interface** - Control states with commands like "Fork a state for trying authentication"
- **Semantic Search** - Embedding-based search using OpenRouter API
- **State Recommendations** - Intelligent suggestions for unfinished experiments and similar states

### Visual State Management
- **State Graph Visualization** - D3.js graph showing state relationships (like Git graph)
- **Interactive State Operations** - Click to switch, drag to merge states
- **Timeline Integration** - State transitions shown in timeline with visual markers
- **State Boundaries** - Visual markers group events by state

### Core Features
- **Real-time Statistics** - Live counts of sessions, entries, events, and code changes
- **AI-Annotated Timeline** - Events displayed with Lucide icons and AI descriptions
- **Smart Filtering** - Filter by source, type, intent, or workspace
- **Code Change Visualization** - Side-by-side before/after code diffs
- **Content Display** - Full prompts, responses, and notes with syntax highlighting
- **Auto-refresh** - Automatically polls companion service for new data
- **Modular Architecture** - Clean separation of HTML templates, view logic, and utilities
- **Advanced Data Export** - Export with date ranges, type filters, and customizable options
- **Data Linking** - Automatic linking of prompts to resulting code changes
- **Image Proxy** - Secure local image serving for screenshots and images in prompts
- **Temporal Analysis** - Time-based grouping of related activities
- **Event Tagging** - Automatic tagging with visual badges
- **Activity Sessions** - Grouped temporal threads showing related activities

### Visualizations

#### Overview Page
- **Activity Heatmap** - Year-long activity calendar showing daily coding intensity
- **Activity Rhythm** - D3.js visualization of coding patterns by hour of day (6am, 12pm, 6pm labels)
- **Productivity Pulse** - Circular gauge comparing today's activity to weekly average

#### Analytics Page
- **AI Activity & Code Output** - Correlation between prompts and code changes over time (hourly/daily/weekly/monthly)
- **Context Usage Over Time** - AI context window utilization with color-coded thresholds
- **Model Usage Analytics** - Distribution of AI models used across prompts and modes
- **File Changes by Type** - Breakdown of modifications by file extension
- **Recent Activity** - 15-minute interval timeline of development events
- **Context File Analytics** - Analysis of @ referenced files and context patterns
- **Enhanced Context Window Analytics** - Real metrics: file references, token counts, adoption rate
- **Productivity Insights** - Active coding time, prompt iteration patterns, line changes, code churn
- **Prompt Effectiveness** - Time from prompt to code change, success rate, iteration patterns
- **Context Evolution Timeline** - Tracks context window changes, file additions/removals over time
- **Prompt-to-Code Correlation** - Success rate, time to first change, code change patterns
- **Git Commit Timeline** - Commit history with messages, timestamps, and branch information
- **File Hotspots** - Most frequently edited files with edit counts, lines changed, and activity scores

#### File Graph Page
- **Semantic File Network** - Interactive network graph showing file relationships
- **File Dependency Strength** - File relationships based on co-occurrence and temporal patterns
- **File Complexity Trends** - Edit frequency, code churn, and complexity scores over time
- **Prompt Embeddings Analysis** - Semantic similarity visualization using PCA/t-SNE/MDS
- **Term Frequency Analysis** - TF-IDF analysis of important terms across files
- **AI-Generated Cluster Labels** - Cluster names and descriptions using OpenRouter

#### States Page
- **State Graph Visualization** - D3.js force-directed graph of state relationships
- **State List** - All states with actions (switch, fork, view details)
- **State Recommendations** - Unfinished experiments and similar states
- **Natural Language Commands** - Create, fork, merge states via search palette

#### Navigator Page
- **Semantic Navigator** - UMAP-based codebase visualization in latent space
- **Physical/Latent/Hybrid Views** - Different perspectives on file relationships
- **Semantic Insights** - Automatically discovered patterns and clusters

#### Workspace Comparison
- **Multi-Workspace Analysis** - Compare activity across multiple workspaces
- **Add/Remove Workspaces** - Dynamic workspace selection for comparison

## Quick Start

### Option 1: Using the rebuild-run-open script (Recommended)
```bash
cd cursor-telemetry/components/activity-logger
./rebuild-run-open.sh
```

### Option 2: Manual Start

1. **Start the Companion Service** (if not already running):
   ```bash
   cd companion
   npm start
   ```

2. **Start the Dashboard**:
   ```bash
   cd public
   python3 -m http.server 8080
   ```

3. **Open the Dashboard**:
   - Go to `http://localhost:8080/dashboard.html`
   - The dashboard will automatically open in your browser

## Architecture Overview

The dashboard uses a **modular, refactored architecture** with clear separation of concerns:

### Project Structure

```
public/
├── dashboard.html              # Main HTML entry point
├── dashboard.js                # Main dashboard logic
├── dashboard.css               # Main stylesheet
│
├── core/                       # Core application modules
│   ├── config.js              # Configuration management
│   ├── state.js               # Application state management
│   ├── api-client.js          # API communication
│   ├── view-router.js         # View routing and navigation
│   └── websocket-manager.js   # WebSocket connections
│
├── views/                      # View modules (one per dashboard view)
│   ├── overview/
│   │   ├── index.js           # View rendering logic
│   │   ├── helpers.js         # HTML template helpers
│   │   └── styles.css         # View-specific styles
│   │
│   ├── activity/
│   │   ├── index.js           # Activity view logic
│   │   ├── timeline-helpers.js # Timeline rendering templates
│   │   └── styles.css
│   │
│   ├── threads/
│   │   ├── index.js           # Threads view logic
│   │   ├── helpers.js         # Thread/prompt templates
│   │   └── styles.css
│   │
│   ├── analytics/
│   │   ├── index.js           # Analytics view logic
│   │   ├── chart-helpers.js   # Chart rendering helpers
│   │   └── styles.css
│   │
│   ├── file-graph/
│   │   ├── index.js           # File graph view logic
│   │   ├── templates.js       # HTML templates
│   │   └── styles.css
│   │
│   ├── navigator/
│   │   ├── index.js           # Navigator view logic
│   │   ├── templates.js       # HTML templates
│   │   └── styles.css
│   │
│   ├── system/
│   │   ├── index.js           # System view logic
│   │   ├── templates.js       # HTML templates
│   │   └── styles.css
│   │
│   └── api-docs/
│       ├── index.js           # API docs view logic
│       └── templates.js       # HTML templates
│
├── utils/                      # Shared utility modules
│   ├── helpers.js             # General utilities (escapeHtml, truncate, etc.)
│   ├── file-helpers.js        # File path utilities
│   ├── math-helpers.js        # Mathematical utilities
│   ├── data-helpers.js        # Data processing utilities
│   ├── time-formatting.js     # Time formatting (formatTimeAgo)
│   ├── event-helpers.js       # Event processing (getEventTitle, getEventDescription)
│   ├── temporal-threading.js  # Temporal grouping logic
│   └── templates.js           # Reusable HTML template utilities
│
├── services/                   # Service modules
│   ├── data/
│   │   ├── persistent-storage.js  # IndexedDB storage
│   │   └── data-synchronizer.js   # Data sync logic
│   ├── analytics/
│   │   ├── analytics-manager.js
│   │   ├── analytics-aggregator.js
│   │   └── prompt-analytics-engine.js
│   └── search/
│       ├── search-engine.js
│       └── semantic-analysis-engine.js
│
├── components/                 # Reusable UI components
│   ├── charts/                # Chart components
│   ├── modals/                # Modal dialogs
│   └── ...
│
└── visualizations/            # Complex visualizations
    ├── file-graph-visualizer.js
    └── time-series-visualizer.js
```

## Architecture Principles

### Separation of Concerns

1. **HTML Templates** → Separate template files (`templates.js`, `helpers.js`)
   - All HTML markup is in dedicated template modules
   - Templates export functions that return HTML strings
   - No HTML embedded directly in view logic files

2. **View Logic** → View `index.js` files
   - Contains only rendering orchestration
   - Calls template functions to generate HTML
   - Handles initialization and lifecycle

3. **Business Logic** → Utility modules
   - Pure functions for data processing
   - Reusable across multiple views
   - No HTML or DOM manipulation

### Module Loading Order

The `dashboard.html` loads modules in a specific order:

1. **Core utilities** (no dependencies)
   - `utils/helpers.js`
   - `utils/time-formatting.js`
   - `utils/event-helpers.js`
   - `utils/temporal-threading.js`

2. **View helpers** (may depend on utilities)
   - `views/activity/timeline-helpers.js`
   - `views/overview/helpers.js`
   - `views/threads/helpers.js`

3. **View templates** (may depend on helpers)
   - `views/*/templates.js` files

4. **View logic** (depends on templates/helpers)
   - `views/*/index.js` files

5. **View router** (depends on all views)
   - `core/view-router.js`

### Function Exports

All functions are exported to `window` for global access:

```javascript
// Template functions
window.renderFileGraphViewTemplate = renderFileGraphViewTemplate;
window.renderSystemStatus = renderSystemStatus;

// View functions
window.renderOverviewView = renderOverviewView;
window.renderActivityView = renderActivityView;

// Utility functions
window.formatTimeAgo = formatTimeAgo;
window.getEventTitle = getEventTitle;
```

## Dashboard Interface

### View Navigation

The dashboard includes multiple specialized views:

- **Overview** - Summary statistics, activity heatmap, activity rhythm, productivity pulse
- **Activity** - Unified timeline with AI annotations, state transitions, and temporal threading
- **States** - Visual state management with graph visualization and natural language commands
- **Threads** - Conversation threads and captured prompts
- **Analytics** - Comprehensive charts and statistics for productivity insights (13+ visualizations)
- **File Graph** - Semantic file relationship visualization with AI-generated cluster labels
- **Navigator** - UMAP-based codebase navigation in latent space
- **Workspace Comparison** - Compare activity metrics across multiple workspaces
- **System** - System resource monitoring
- **API Docs** - Complete API documentation

### Key Features

- **AI-Annotated Timeline** - Events show AI-generated descriptions with Lucide icons
- **State Transitions** - Visual markers for state forks, merges, and switches
- **Natural Language Commands** - Control states via search palette (⌘K)
- **Alternating Timeline Layout** - Events on left, prompts on right
- **Temporal Threading** - Groups related activities by time windows
- **Conversation Threading** - Groups AI prompts by conversation ID
- **Real-time Updates** - WebSocket connections for live data
- **Persistent Storage** - IndexedDB caching for fast startup
- **Data Linking** - Prompts automatically linked to resulting code changes
- **Temporal Chunks** - Time-based grouping with all metadata
- **Linked Data** - Explicit prompt-code relationships in exports
- **Intent Badges** - Color-coded badges showing event intent

## Development

### Adding a New View

1. Create view directory: `public/views/my-view/`
2. Create template file: `templates.js` (or `helpers.js` for smaller views)
3. Create view logic: `index.js`
4. Export functions to `window`
5. Add script tags to `dashboard.html` (in correct order)
6. Register view in `core/view-router.js`

### Modifying Templates

Templates are in dedicated files:
- Large views: `views/{view-name}/templates.js`
- Helper components: `views/{view-name}/helpers.js`

### Adding Utilities

1. Add utility function to appropriate `utils/*.js` file
2. Export to `window` for global access
3. Load script in `dashboard.html` before dependent modules

## Data Sources

The dashboard connects to the companion service (port 43917) and displays:

1. **File Changes** - Complete before/after code with file paths
2. **AI Prompts** - Prompts from Cursor's database with conversation metadata
3. **Terminal Commands** - Command history with exit codes
4. **System Events** - Logging and status events
5. **Context Snapshots** - Context window usage analytics

## Data Export Features

The dashboard provides comprehensive export functionality with fine-grained control over what data is exported.

### Export Options Modal

Access the export options via the "Export Data" button in the dashboard. The modal allows you to configure:

- **Date Range** - Filter data by `From` and `To` dates
  - Quick presets: Today, Last Week, Last Month, All Time
- **Data Types** - Select which types of data to include:
  - File Changes (code edits, file modifications)
  - AI Prompts (captured prompts and conversations)
  - Terminal Commands (command line activity)
  - Context Snapshots (workspace context data)
- **Export Options** - Toggle specific data inclusions:
  - Include Code Diffs (before/after code content)
  - Include Linked Data (prompt-code relationships)
  - Include Temporal Chunks (time-based groups)
  - Full Metadata (all available fields)
- **Item Limit** - Control maximum number of items exported

### Export API Endpoint

The export functionality is available via the API:

```
GET /api/export/database
```

**Query Parameters:**
- `limit` - Maximum items to export (default: 1000)
- `since` - Start date (ISO format: `YYYY-MM-DD`)
- `until` - End date (ISO format: `YYYY-MM-DD`)
- `exclude_events` - Exclude events if `true`
- `exclude_prompts` - Exclude prompts if `true`
- `exclude_terminal` - Exclude terminal commands if `true`
- `exclude_context` - Exclude context snapshots if `true`
- `no_code_diffs` - Exclude code diffs if `true`
- `no_linked_data` - Exclude linked data if `true`
- `no_temporal_chunks` - Exclude temporal chunks if `true`
- `full` - Include all metadata fields if `true`

**Example:**
```bash
curl "http://localhost:43917/api/export/database?limit=5000&since=2025-01-01&until=2025-01-31&exclude_terminal=true"
```

### Export Structure

The exported JSON file contains:

- **Metadata** - Export information, counts, date ranges, filters applied
- **Temporal Chunks** - Time-based groups of related activities with all metadata
- **Linked Data** - Explicit prompt-code relationships (prompt → code change)
- **Entries** - All file changes with code diffs
- **Prompts** - All captured prompts with context
- **Events** - Activity events
- **Terminal Commands** - Command history
- **Context Snapshots** - Context usage over time
- **Context Analytics** - Aggregated context statistics
- **Workspaces** - Workspace information
- **Unlinked** - Items without explicit links
- **Stats** - Summary statistics

See [`EXPORT_CONTENTS.md`](./EXPORT_CONTENTS.md) for detailed export structure documentation.

## Data Import & Redeploy

The dashboard supports importing previously exported data to restore or merge telemetry data.

### Import Functionality

Access the import feature via the "Import Data" button in the dashboard. The import system:

- **Schema Validation** - Validates imported data structure against expected schema
- **Merge Strategy** - Options to merge with existing data or replace it
- **Data Deduplication** - Automatically handles duplicate entries based on timestamps and IDs
- **Workspace Preservation** - Maintains workspace associations from imported data
- **Progress Tracking** - Shows import progress and statistics

### Import API Endpoint

```
POST /api/import/database
```

**Request Body:**
- JSON file matching the export structure (see [Export Structure](#export-structure))

**Query Parameters:**
- `merge` - If `true`, merges with existing data; if `false`, replaces existing data (default: `true`)
- `validate` - If `true`, validates schema before importing (default: `true`)

**Example:**
```bash
curl -X POST "http://localhost:43917/api/import/database?merge=true" \
  -H "Content-Type: application/json" \
  -d @exported-data.json
```

### Use Cases

- **Backup & Restore** - Export data before major changes, restore if needed
- **Data Migration** - Move telemetry data between systems
- **Workspace Consolidation** - Merge data from multiple sources
- **Development/Testing** - Import sample data for testing visualizations

## Data Linking

The system automatically links related data to provide context and relationships:

### Prompt-Code Linking

- **Automatic Linking** - When a prompt results in code changes, they are automatically linked
- **Linked Data Array** - Exports include a `linked_data` array with explicit relationships
- **Bidirectional Navigation** - View prompts from code changes, and code changes from prompts
- **Event Modals** - Show linked prompts when viewing code changes
- **Prompt Modals** - Show resulting code changes when viewing prompts
- **Database Links Over Time Correlation** - Prompt effectiveness metrics use explicit database links (`linked_entry_id`/`prompt_id`) rather than time-based correlation. This ensures accuracy by only counting confirmed relationships, avoiding false positives from coincidental temporal proximity.

### Temporal Chunks

- **Time-Based Grouping** - Activities are grouped by time proximity (5-minute windows)
- **Complete Context** - Each chunk includes all related prompts, events, and code changes
- **Metadata Preservation** - All original metadata is preserved in chunks
- **Workflow Analysis** - Enables analysis of multi-step development workflows

### Using Linked Data

Linked data is useful for:
- Understanding which prompts led to which code changes
- Analyzing workflow patterns
- Tracking development sessions
- Exporting training data (prompt-code pairs)

## Image Proxy Support

The dashboard can display local images (screenshots, images referenced in prompts) through a secure proxy endpoint.

### How It Works

- Images referenced in prompts/events are automatically proxied through `/api/image`
- The companion service securely serves local files from your home directory
- Supports common image formats: PNG, JPG, JPEG, GIF, WEBP, SVG, BMP

### Image API Endpoint

```
GET /api/image?path=<image_path>
```

**Parameters:**
- `path` - Relative or absolute path to image file
  - Relative paths: Resolved from user's home directory
  - Example: `Desktop/screenshot.png` → `~/Desktop/screenshot.png`

**Security:**
- Only files within user's home directory are accessible
- Path validation prevents directory traversal
- File type validation (only image files)

**Example Usage:**
```html
<img src="http://localhost:43917/api/image?path=Desktop/screenshot.png" />
```

**In Modals:**
Screenshots captured near events are automatically displayed using the image proxy. Images that cannot be accessed will show a fallback message.

## API Endpoints

### Companion Service API (port 43917)

#### Data Export
- `GET /api/export/database` - Export database with filters (see [Data Export Features](#data-export-features))

#### Image Serving
- `GET /api/image?path=<path>` - Serve local images securely (see [Image Proxy Support](#image-proxy-support))

#### Health & Status
- `GET /health` - Service health check
- `GET /api/stats` - Dashboard statistics

#### Data Retrieval
- `GET /api/entries` - Get file changes
- `GET /api/prompts` - Get prompts
- `GET /api/events` - Get events
- `GET /api/terminal` - Get terminal commands
- `GET /api/context` - Get context snapshots
- `GET /api/activity` - Get activity data with filters

#### Context Analytics
- `GET /api/context/analytics` - Get context usage analytics

All endpoints support CORS and are accessible from the dashboard running on any port.

## Auto-refresh

The dashboard automatically:
- Polls the companion service every 2 seconds
- Updates statistics in real-time
- Refreshes views when new data arrives
- Maintains connection status indicators
- Uses IndexedDB for persistent caching

## Troubleshooting

### No Data Showing
1. Check companion service is running on port 43917
2. Click "Test Connection" to verify connectivity
3. Check browser console for errors
4. Verify module loading order in Network tab

### Template Functions Not Found
1. Check `dashboard.html` loads all required template files
2. Verify function exports with `window.{functionName}` in console
3. Check script loading order (templates before views)

### View Not Rendering
1. Check `core/view-router.js` registers the view
2. Verify view function exported to `window`
3. Check browser console for JavaScript errors

## Dependencies

### Core Libraries
- **Chart.js** - Chart rendering
- **D3.js** - Graph visualizations
- **UMAP.js** - Dimensionality reduction
- **Lunr.js** - Full-text search

### Browser APIs
- **IndexedDB** - Persistent storage
- **WebSocket** - Real-time updates
- **Service Worker** - Caching and offline support

## Additional Documentation

- **[Export Contents](./EXPORT_CONTENTS.md)** - Detailed documentation of export JSON structure
- **[Dashboard Status](./DASHBOARD_STATUS.md)** - Feature completeness and recommendations

## Next Steps

The dashboard is now ready to use! It will automatically display all your Cursor activity data in a beautiful, modern interface. The modular architecture makes it easy to extend and maintain.

### Refactoring Status

**Completed:**
- All HTML templates extracted to separate modules
- View logic separated from templates
- Utility functions organized into dedicated modules
- Proper module loading order established
- All functions exported and accessible
- Advanced export system with filters and options
- Data import/redeploy functionality with schema validation
- Data linking (prompt-code relationships)
- Image proxy support
- Temporal chunks and analytics
- Event tagging system with visual badges
- Activity Session display with improved layout
- 13+ analytics visualizations (Context Evolution, Prompt-to-Code Correlation, Git Timeline, File Hotspots, etc.)
- Overview page redesign with Activity Rhythm (D3.js) and Productivity Pulse
- Workspace comparison with multi-workspace support
- File Dependency Strength and Complexity Trends visualizations
- Responsive design improvements
- Accessibility enhancements (ARIA labels, keyboard navigation, focus states)
- Performance optimizations (chunked processing, conditional loading)

Enjoy monitoring your Cursor activity!
