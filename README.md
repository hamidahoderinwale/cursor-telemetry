# PKL Dashboard - Procedural Knowledge Library

Real-time monitoring and analysis system for Cursor IDE sessions with privacy-preserving workflow analysis capabilities and advanced embeddings-based intent classification.

## Architecture

### Core Components

- **Node.js Web Server** (Port 3000): Express API with WebSocket support and real-time event processing
- **Event Queue System**: Memory-based priority queue with correlation and deduplication (optimized for real-time capture)
- **Real-time Monitor**: File system watcher with chokidar for live session tracking across multiple file types
- **Session Builder**: Event correlation and session boundary detection with configurable timeouts
- **Data Storage**: SQLite with JSON storage for sessions and conversations
- **Embeddings Intent Classifier**: 512-dimensional embeddings with 8 multi-faceted analysis dimensions

### Event Processing Pipeline

- **Event Capture**: Multi-source event collection (notebooks, Cursor DB, manual API) with immediate processing
- **Event Queue**: Priority-based processing (high/medium/low) with retry logic and real-time optimization
- **Correlation Engine**: Smart event correlation with configurable rules and 5-second correlation window
- **Session Building**: Real-time session construction from correlated events with 1-minute timeout
- **WebSocket Broadcasting**: Live updates to connected clients with immediate event triggers

### Analysis & Intelligence

- **Kura Integration**: Hierarchical clustering with UMAP visualization and embeddings-based coordinates
- **OpenClio Integration**: Multi-dimensional facet analysis with sophisticated intent classification
- **Embeddings Intent Classification**: 512-dimensional embeddings with 8 multi-faceted analysis dimensions:
  - Cognitive Complexity (low/medium/high/expert)
  - Workflow Pattern (exploratory/iterative/systematic/experimental)
  - Domain Expertise (beginner/intermediate/advanced/expert)
  - Problem-Solving Approach (analytical/creative/pragmatic/theoretical)
  - Data Interaction (consumption/transformation/analysis/modeling)
  - Communication Style (concise/detailed/collaborative/independent)
  - Temporal Pattern (burst/sustained/episodic/continuous)
  - Tool Usage (minimal/moderate/extensive/specialized)
- **Procedure Pattern Detection**: Automated workflow pattern recognition
- **Privacy Engine**: Differential privacy with configurable epsilon values and content analysis

### Frontend Components

- **Live Dashboard**: Real-time session monitoring with WebSocket updates, search functionality, and project organization
- **Enhanced Dashboard**: Kura clustering visualization interface with UMAP embeddings and embeddings-based facet visualization
- **Privacy Analysis Interface**: Interactive privacy configuration with real-time metrics and content analysis
- **Export System**: Multi-format export (JSON, CSV, Markdown, PDF)
- **Session Management**: Annotation, context return, and session control with clickable session cards
- **Interactive Timeline**: Event scrubbing with code diff visualization and automatic analysis on page load
- **Search and Filtering**: Comprehensive search across all session properties with intent and outcome filters
- **Project Organization**: Automatic categorization and grouping of sessions based on file paths
- **Embeddings Visualization**: Radial layout visualization of high-dimensional intent facets with interactive tooltips

### CSS Architecture

- **Component-Based Structure**: Modular CSS organization with separate files for each component
- **CSS Variables System**: Comprehensive design system using CSS custom properties for colors, typography, spacing, and transitions
- **Grayscale Theme**: Professional grayscale color palette with consistent contrast ratios and accessibility
- **Typography**: Funnel Sans font family with consistent sizing and weight scales
- **Responsive Design**: Mobile-first approach with flexible grid layouts and adaptive components
- **Performance**: Optimized CSS loading with preload hints and minimal render-blocking resources

## Installation

### Prerequisites

- Node.js 18.0.0+
- Python 3.8+
- SQLite3
- OpenAI API key

### Setup

```bash
git clone <repository-url>
cd cursor_dashboard/cursor-pkl-extension
npm install
pip install -r requirements.txt
cp .env.example .env  # Configure OpenAI API key
npm run build
node src/web-interface/web-server.js
```

### Access Points

- **Main Dashboard**: `http://localhost:3000`
- **Enhanced Dashboard**: `http://localhost:3000/dashboard/enhanced`
- **Privacy Analysis**: `http://localhost:3000/privacy-analysis`
- **API Health**: `http://localhost:3000/api/health`

## API Endpoints

### Session Management

- `GET /api/sessions` - Retrieve all sessions
- `GET /api/session/:id` - Get session details with full metadata
- `POST /api/session/:id/annotation` - Add session annotation
- `POST /api/session/:id/return-to-context` - Return to Cursor context

### Event Processing

- `GET /api/event-queue/stats` - Event queue statistics
- `POST /api/capture-prompt` - Capture prompt with code changes
- `POST /api/conversations` - Manual conversation data
- `POST /api/conversations/capture` - Immediate real-time conversation capture

### Analysis

- `POST /api/sessions/analyze-with-kura` - Kura clustering analysis with embeddings integration
- `GET /api/visualizations` - Aggregated visualization data
- `GET /api/procedures/patterns` - Detected procedure patterns
- `GET /api/projects` - Project organization and categorization
- `GET /api/projects/:projectId` - Specific project details
- `GET /api/projects/:projectId/sessions` - Sessions for a specific project

### Export & Privacy

- `POST /api/export` - Multi-format data export
- `POST /api/privacy/analyze` - Privacy impact analysis
- `POST /api/privacy/config` - Update privacy configuration

## Data Models

### Session Model

```json
{
  "id": "session-1758766138575",
  "timestamp": "2025-09-25T02:30:24.163Z",
  "intent": "implement",
  "outcome": "IN_PROGRESS",
  "confidence": 0.85,
  "currentFile": "/path/to/notebook.ipynb",
  "fileChanges": [...],
  "codeDeltas": [...],
  "conversations": [...],
  "annotations": [],
  "duration": 0,
  "metadata": {...}
}
```

### Event Queue Model

```json
{
  "id": "event-123",
  "type": "prompt|file_change|code_execution|conversation|response",
  "timestamp": "2025-09-25T02:30:24.163Z",
  "source": "manual_capture|notebook_monitor|cursor_db|file_system",
  "data": {...},
  "sessionId": "session-123",
  "correlationId": "prompt-1758768095155",
  "priority": "high|medium|low"
}
```

## Privacy Configuration

### Differential Privacy

- **Epsilon (ε)**: Privacy budget control (0.1 to 10.0)
- **Token Redaction**: Percentage-based redaction (0% to 100%)
- **Procedural Abstraction**: Multi-level abstraction (1-5)
- **Data Retention**: Configurable retention policies

### Privacy Settings

```json
{
  "epsilon": 1.0,
  "redactionLevel": 50,
  "abstractionLevel": 3,
  "redactNames": true,
  "redactNumbers": true,
  "redactEmails": true,
  "dataRetention": "30d",
  "anonymizeSessions": false
}
```

## Recent Updates and Improvements

### CSS Refactoring and Repository Cleanup

- **Consolidated CSS Architecture**: Refactored CSS into component-based structure with consistent design system using CSS variables
- **Grayscale Design System**: Implemented comprehensive grayscale color palette with CSS custom properties for consistent theming
- **Component-Based CSS**: Organized styles into modular components (header, navigation, session-cards, visualizations, etc.)
- **Removed Duplicate Files**: Cleaned up repository by removing unused CSS files and consolidating styles
- **Fixed JavaScript Syntax Errors**: Resolved class structure issues and duplicate method definitions in dashboard.js
- **Updated File References**: Corrected CSS and JavaScript file paths in HTML templates
- **Button Styling**: Standardized button styles with hover effects and proper color variables

### Enhanced Intent Classification System

- **Embeddings-Based Classification**: Replaced hardcoded intent classifications with sophisticated 512-dimensional embeddings
- **Multi-Faceted Analysis**: 8-dimensional analysis covering cognitive complexity, workflow patterns, domain expertise, and more
- **High-Dimensional Visualization**: Radial layout visualization of intent facets with interactive tooltips
- **Dynamic Facet Updates**: Real-time updates to session cards showing embeddings-based intent analysis

### Real-Time Processing Optimizations

- **Immediate Event Capture**: Optimized event queue for real-time processing with 100ms intervals
- **Faster Correlation**: Reduced correlation window to 5 seconds for immediate event correlation
- **Enhanced Broadcasting**: Immediate WebSocket broadcasting for real-time dashboard updates
- **Content Analysis**: Privacy violations detection through actual content analysis instead of random generation

### Project Organization and Search

- **Automatic Project Detection**: Intelligent categorization of sessions based on file paths
- **Comprehensive Search**: Search across all session properties including embeddings facets
- **Advanced Filtering**: Intent and outcome filters with embeddings-based classification
- **Project Navigation**: Hierarchical project organization with session grouping

## Performance Metrics

- **Event Processing**: ~1000 events/second capacity with real-time optimization
- **Session Correlation**: 5-second correlation window for immediate processing
- **WebSocket Latency**: <100ms for real-time updates with immediate event triggers
- **Memory Usage**: Configurable limits with automatic cleanup
- **Storage**: Automatic data retention and compression
- **Embeddings Processing**: 512-dimensional analysis with 8-facet classification
- **Search Performance**: Comprehensive search across all session properties with debounced input

## System Verification

### Health Checks

```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/event-queue/stats
curl http://localhost:3000/api/stats
```

### Verified Components

- Event Queue System with priority processing and real-time optimization
- Real-time monitoring with file system watching across multiple file types
- Session building with event correlation and configurable timeouts
- WebSocket updates for live client notifications with immediate triggers
- Export system with multi-format support
- Kura integration for hierarchical clustering with embeddings-based coordinates
- Privacy engine with differential privacy and content analysis
- Interactive timeline with code diff visualization and automatic analysis
- **CSS Architecture**: Component-based CSS structure with consistent design system
- **JavaScript Structure**: Fixed class definitions and removed duplicate methods
- **Embeddings Classification**: 512-dimensional intent classification with 8-facet analysis
- **Project Organization**: Automatic session categorization and hierarchical grouping
- **Search and Filtering**: Comprehensive search with debounced input and advanced filters
- **Real-Time Processing**: Optimized event processing with immediate capture and broadcasting

## Development

### Project Structure

```text
cursor_dashboard/
├── cursor-pkl-extension/          # Main Node.js application
│   ├── app/                      # TypeScript services
│   ├── src/                      # JavaScript components
│   │   ├── web-interface/        # Web server and dashboard
│   │   ├── data-processing/      # Storage and export services
│   │   └── clio-integration/     # Kura and OpenClio integration
│   └── dist/                     # Compiled TypeScript
└── docs/                         # Documentation
```

### Testing

```bash
npm test
python -m pytest tests/
npm run test:integration
```

## License

MIT License - see LICENSE file for details.
