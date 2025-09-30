# Cursor Telemetry Dashboard

A comprehensive real-time dashboard system for monitoring, analyzing, and integrating Cursor IDE activity with advanced data science workflow insights and memory management capabilities. **Specifically designed for Jupyter notebook users working in Cursor IDE.**

## Project Overview

The Cursor Telemetry Dashboard is an intelligent monitoring and analysis platform that captures, processes, and visualizes development activities from Cursor IDE. It provides deep insights into data science workflows through advanced cell-stage classification, real-time session tracking, and executable memory generation. **This tool is specifically optimized for users working with Jupyter notebooks (.ipynb files) in Cursor IDE.**

### Key Capabilities

- **Real-time Activity Monitoring**: Live tracking of code changes, file modifications, and development sessions
- **Advanced Cell-Stage Classification**: Granular analysis of notebook cells using AST parsing, Clio facets, and multi-dimensional scoring
- **Memory Generation Engine**: Converts development sessions into executable Cursor memories and Jupyter notebooks
- **Memory Management System**: Comprehensive interface for creating, organizing, searching, and executing stored memories
- **Dynamic Integration**: Seamless integration with Cursor IDE through file-based context restoration
- **Comprehensive Analytics**: V-measure completeness metrics, complexity analysis, and workflow insights

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Cursor Telemetry Dashboard               │
├─────────────────────────────────────────────────────────────┤
│  Frontend Dashboard (React-like Components)                │
│  ├── Real-time Visualizations (D3.js)                     │
│  ├── Session Management Interface                          │
│  ├── Memory Generation UI                                  │
│  ├── Memory Management Interface                           │
│  ├── Privacy Controls UI                                   │
│  └── Analytics Dashboard                                   │
├─────────────────────────────────────────────────────────────┤
│  Backend Services (Node.js/Express)                        │
│  ├── Web Server (Express + Socket.IO)                     │
│  ├── Cell Stage Classifier (AST + Clio)                   │
│  ├── Memory Generation Engine                              │
│  ├── Privacy Service (Post-Processing)                     │
│  ├── File-based Integration Service                        │
│  └── Data Storage (SQLite + JSON)                         │
├─────────────────────────────────────────────────────────────┤
│  Companion Service (Activity Logger) - Port 43917         │
│  ├── File System Monitoring (Chokidar)                    │
│  ├── Code Delta Detection                                  │
│  ├── Clipboard Monitoring                                  │
│  ├── DOM Change Detection                                  │
│  ├── MCP Integration                                       │
│  └── WebSocket Communication                               │
├─────────────────────────────────────────────────────────────┤
│  Integration Layer                                         │
│  ├── Cursor IDE Integration (.cursor-session files)       │
│  ├── Notebook Generation (Jupyter/Colab)                  │
│  ├── Memory Export/Import System                           │
│  └── SDK (JavaScript/Python)                              │
└─────────────────────────────────────────────────────────────┘
```

### Privacy Architecture Note

**Current Status**: The privacy controls are **not connected** to the actual data capture mechanisms. The activity logger companion service captures all data regardless of privacy settings, while the main dashboard only applies privacy transformations to already-captured data.

**Key Issues**:
- No consent collection during onboarding
- No real-time privacy control over data capture
- No data deletion capabilities
- Privacy controls only affect display, not capture

See `PRIVACY_CONTROLS_ANALYSIS.md` for detailed analysis and recommendations.

### Data Flow

1. **Activity Capture**: Companion service (port 43917) monitors file changes, clipboard, and DOM changes
2. **Real-time Processing**: WebSocket communication delivers live updates to dashboard (port 3000)
3. **Cell Classification**: Advanced AST and Clio-based analysis of notebook cells
4. **Memory Generation**: Conversion of sessions into executable artifacts
5. **Privacy Processing**: Post-capture privacy transformations (not connected to capture)
6. **Context Restoration**: File-based integration with Cursor IDE

## Tech Stack

### Frontend
- **HTML5/CSS3**: Semantic markup with CSS variables and component-based styling
- **JavaScript (ES6+)**: Modular architecture with class-based components
- **D3.js**: Data visualization and interactive charts
- **Socket.IO Client**: Real-time communication
- **Funnel Sans**: Typography system

### Backend
- **Node.js**: Runtime environment
- **Express.js**: Web server framework
- **Socket.IO**: Real-time bidirectional communication
- **Chokidar**: File system monitoring
- **SQLite**: Primary data storage (`cursor_process_mining.db`)
- **JSON Storage**: Lightweight data persistence

### Analysis & Integration
- **AST Parsing**: Abstract Syntax Tree analysis for code complexity
- **Clio Integration**: Faceted analysis for enhanced classification
- **V-Measure Metrics**: Clustering evaluation and completeness scoring
- **AppleScript**: macOS integration for Cursor IDE

## Key Terms & Concepts

### Cell Stage Classification
- **Import Dependencies**: Loading libraries, modules, and external packages
- **Data Loading**: Reading and importing datasets from various sources
- **Data Preprocessing**: Cleaning, transforming, and preparing data
- **Exploratory Analysis**: Initial data exploration and pattern discovery
- **Statistical Analysis**: Statistical tests, correlations, and hypothesis testing
- **Machine Learning**: Model training, validation, and prediction
- **Data Visualization**: Creating charts, plots, and visual representations
- **Interactive Visualization**: Dynamic, interactive charts and dashboards
- **Results Interpretation**: Analyzing and explaining findings
- **Documentation**: Code comments, docstrings, and markdown explanations
- **Testing & Validation**: Unit tests, validation checks, and quality assurance
- **Utility Functions**: Helper functions and reusable code components
- **Configuration**: Settings, parameters, and environment configuration

### Memory System
- **Memory Generation**: Converting development sessions into executable artifacts
- **Context Restoration**: Recreating development context in Cursor IDE
- **Session Snapshots**: Complete state capture of development sessions
- **Executable Notebooks**: Generated Jupyter notebooks with session data
- **Cursor Session Files**: `.cursor-session` files for IDE integration
- **Memory Storage**: Persistent storage with JSON-based database
- **Memory Execution**: Running stored memories to recreate development contexts
- **Memory Management**: Search, filter, export, and organize memories
- **Quality Metrics**: V-measure scoring and execution tracking
- **Memory Templates**: Reusable patterns for common development workflows

### Analytics Metrics
- **V-Measure**: Clustering quality metric (completeness × homogeneity)
- **Complexity Analysis**: Code complexity scoring based on AST analysis
- **Clio Facets**: Multi-dimensional analysis categories (DataScienceIntent, AnalysisType, etc.)
- **Session Insights**: Holistic analysis of development patterns and workflows

## API Reference

### Core Endpoints

#### Sessions
- `GET /api/sessions` - Retrieve all sessions
- `GET /api/sessions/search?q={query}` - Search sessions
- `GET /api/session/:id` - Get specific session details

#### Privacy Controls
- `POST /api/privacy/analyze` - Run privacy analysis on captured data
- `GET /api/privacy/config` - Get current privacy configuration
- `POST /api/privacy/config` - Update privacy configuration
- `GET /api/privacy/metrics` - Get privacy metrics
- `GET /api/privacy/export` - Export privacy report
- `DELETE /api/privacy/delete` - Delete sensitive data

#### Activity Logger (Companion Service - Port 43917)
- `GET /health` - Get companion service status
- `GET /stats` - Get activity logger statistics
- `GET /config` - Get companion configuration
- `POST /config` - Update companion configuration
- `GET /queue` - Get recent events from queue
- `DELETE /queue` - Clear event queue
- `POST /clipboard` - Enable/disable clipboard monitoring
- `POST /file-monitoring` - Enable/disable file monitoring

#### Memory Generation
- `POST /api/session/:id/generate-notebook` - Generate executable notebook
- `POST /api/session/:id/create-session-file` - Create .cursor-session file
- `POST /api/session/:id/create-integration-package` - Create complete package
- `POST /api/session/:id/create-memory` - Create executable memory from session

#### Memory Management
- `GET /api/memories` - Retrieve all memories with filtering
- `GET /api/memories/search?q={query}` - Search memories by content
- `GET /api/memories/stats` - Get memory statistics and metrics
- `POST /api/memories/:id/execute` - Execute a stored memory
- `PUT /api/memories/:id` - Update memory metadata
- `DELETE /api/memories/:id` - Delete a memory
- `POST /api/memories/export` - Export memories in JSON/CSV format
- `POST /api/memories/import` - Import memories from file

#### Data Analysis
- `GET /api/events` - Retrieve development events
- `GET /api/embeddings` - Get session embeddings
- `GET /api/analytics/stage-distribution` - Cell stage distribution

#### File Operations
- `GET /api/download/notebook/:filename` - Download generated notebook
- `GET /api/download/session/:filename` - Download session file

### WebSocket Events

#### Client → Server
- `session-update` - Update session data
- `request-analysis` - Request new analysis
- `subscribe-events` - Subscribe to real-time updates

#### Server → Client
- `sessions-updated` - Session data changes
- `session-created` - New session detected
- `file-changed` - File modification detected
- `analysis-complete` - Analysis results ready

## Quick Start

### Prerequisites
- Node.js 16+ 
- macOS (for AppleScript integration)
- Cursor IDE
- **Jupyter notebook files (.ipynb) for analysis**

### Installation

1. **Clone the repository**:
```bash
git clone https://github.com/hamidahoderinwale/cursor-telemetry.git
cd cursor-telemetry
```

2. **Install dependencies**:
```bash
cd components/dashboard
npm install
```

3. **Start the dashboard**:
```bash
npm start
# or
node src/web-interface/web-server.js
```

4. **Access the dashboard**:
Open `http://localhost:3000` in your browser

### Development Setup

1. **Start companion service** (separate terminal):
```bash
cd components/activity-logger/companion
npm start
```

2. **Enable file monitoring**:
The companion service will automatically start monitoring your development directories.

### Privacy Setup

**Important**: The current privacy controls are not connected to data capture. To properly protect your data:

1. **Review privacy settings** in the dashboard UI
2. **Understand limitations**: Privacy controls only affect display, not capture
3. **Consider data deletion**: Use the privacy API to remove sensitive data
4. **Monitor activity**: Check what data is being captured by the companion service

See `PRIVACY_CONTROLS_ANALYSIS.md` for detailed privacy recommendations.

## Memory System

The Cursor Telemetry Dashboard includes a comprehensive memory system powered by the **PKL Extension** - an intelligent workflow capture and execution engine that transforms your coding sessions into reusable, executable memories.

### What are Memories?

Memories are executable artifacts that capture the complete context of a development session, including:
- **Code files and changes** made during the session
- **Analysis results** from cell stage classification
- **Context information** like file paths, timestamps, and metadata
- **Executable commands** that can recreate the development environment
- **Quality metrics** based on V-measure completeness scoring
- **PKL Facet Analysis** with data science workflow classification
- **Real-time monitoring** of file changes, clipboard activity, and Cursor IDE integration

### Memory Types

#### 1. Session Memories
Created from individual development sessions, containing:
- Complete session context and state
- All code changes and file modifications
- Analysis results and insights
- Executable commands to recreate the session

#### 2. Workflow Memories
Template memories for common development patterns:
- Data analysis workflows
- Model training pipelines
- Visualization creation patterns
- Debugging procedures

#### 3. Integration Memories
Memories that integrate with external tools:
- Cursor IDE session files (`.cursor-session`)
- Jupyter notebook generation
- File system operations
- API integrations

### PKL Extension Features

The PKL Extension provides advanced data science workflow intelligence:

#### Real-Time Monitoring
- **File System Monitoring**: Tracks all code changes with 200ms debouncing
- **Clipboard Monitoring**: Captures copied code snippets and links to sessions
- **Cursor IDE Integration**: Monitors `.cursor-session` files and AI conversations
- **AST Analysis**: Parses code structure for complexity scoring and classification

#### Cell-Stage Classification
Automatically classifies notebook cells into 12 data science stages:
- `import` - Loading libraries and dependencies
- `data_loading` - Reading datasets and external data
- `data_preprocessing` - Cleaning and transforming data
- `exploratory_analysis` - Initial data exploration (EDA)
- `statistical_analysis` - Statistical tests and correlations
- `machine_learning` - Model training and validation
- `visualization` - Creating charts and plots
- `model_evaluation` - Performance metrics and validation
- `deployment` - Production code and APIs
- `testing` - Unit tests and validation
- `utility` - Helper functions and tools
- `configuration` - Settings and parameters

#### PKL Facet Analysis
Multi-dimensional analysis including:
- **Data Science Intent**: EDA, ML, visualization, deployment
- **Analysis Type**: Statistical, machine learning, exploratory
- **Technical Approach**: Libraries, algorithms, methodologies
- **Data Context**: Domain, data types, complexity
- **Procedure Complexity**: 1-5 scale scoring
- **Reproducibility Score**: 1-5 scale for workflow repeatability

### Memory Management

#### Creating Memories
```bash
# Create memory from a session with PKL features
curl -X POST http://localhost:3000/api/session/{sessionId}/create-memory \
  -H "Content-Type: application/json" \
  -d '{
    "category": "analysis",
    "type": "workflow",
    "tags": ["data-science", "visualization"],
    "includeMemories": true,
    "includeASTAnalysis": true,
    "includeKuraAnalysis": true,
    "pklFeatures": true
  }'
```

#### Executing Memories
```bash
# Execute a stored memory
curl -X POST http://localhost:3000/api/memories/{memoryId}/execute \
  -H "Content-Type: application/json" \
  -d '{
    "context": {
      "targetDirectory": "/path/to/workspace",
      "parameters": {
        "datasetPath": "/data/sample.csv"
      }
    }
  }'
```

#### Searching Memories
```bash
# Search memories by content
curl "http://localhost:3000/api/memories/search?q=data%20analysis&category=workflow&limit=10"
```

### Memory Quality Metrics

The system tracks several quality metrics for each memory:

- **Completeness Score (0-1)**: How complete the memory capture is
- **V-Measure Score (0-1)**: Clustering quality and homogeneity
- **File Coverage**: Percentage of relevant files captured
- **Analysis Depth**: Level of analysis performed
- **Execution Success Rate**: How often the memory executes successfully

### Memory Storage

Memories are stored in a JSON-based database located at `~/.pkl/memories/` with the following structure:

```
~/.pkl/memories/
├── memory-index.json          # Index of all memories
├── memory_1234567890.json     # Individual memory files
├── memory_1234567891.json
└── ...
```

### Memory Dashboard

The dashboard includes a dedicated memory management interface with:

- **Memory List**: Grid view of all stored memories
- **Search & Filter**: Find memories by content, category, or tags
- **Memory Details**: View complete memory information and execution history
- **Quality Metrics**: Visual indicators of memory quality
- **Export/Import**: Backup and restore memory collections
- **Execution Controls**: Run memories with custom parameters

### Memory Management Interface

The dashboard features a comprehensive memory management view accessible via the "Memory Management" navigation tab:

- **Statistics Overview**: Total memories, execution count, quality scores, and active memories
- **Interactive Search**: Real-time search across memory content and metadata
- **Category Filtering**: Filter by code, data, workflow, or insight categories
- **Status Management**: View and manage active, executed, and archived memories
- **Memory Actions**: Create new memories, execute existing ones, edit metadata, and delete memories
- **Quality Tracking**: Monitor memory execution success rates and quality metrics over time

### Using Memories in Chat

You can interact with the memory system through the dashboard's chat interface:

#### Commands
- `@memory create from session {sessionId}` - Create memory from session
- `@memory search {query}` - Search memories
- `@memory execute {memoryId}` - Execute a memory
- `@memory list` - List all memories
- `@memory stats` - Show memory statistics
- `@memory export` - Export all memories
- `@memory delete {memoryId}` - Delete a memory

#### Examples
```
@memory create from session session_1234567890
@memory search data visualization
@memory execute memory_abc123def456
@memory list --category=workflow --limit=5
@memory stats
```

### Memory Best Practices

1. **Create memories for successful workflows** that you want to repeat
2. **Use descriptive titles and tags** to make memories easy to find
3. **Include relevant context** in memory descriptions
4. **Test memory execution** before relying on them for important work
5. **Regularly review and clean up** old or unused memories
6. **Export memories** as backups before major system changes
7. **Enable PKL features** for data science workflows to get enhanced analysis
8. **Use cell-stage classification** to understand your development patterns
9. **Monitor reproducibility scores** to improve workflow consistency

### Advanced Memory Features

#### Memory Templates
Create reusable templates for common patterns:
```javascript
const template = {
  name: "Data Analysis Workflow",
  description: "Standard data analysis pipeline",
  commands: [
    { type: "file_operation", action: "create", path: "analysis.py" },
    { type: "notebook_operation", action: "create", path: "notebook.ipynb" }
  ],
  parameters: {
    datasetPath: { type: "string", required: true },
    outputDir: { type: "string", default: "./output" }
  }
};
```

#### Memory Chaining
Execute multiple memories in sequence:
```bash
curl -X POST http://localhost:3000/api/memories/chain-execute \
  -H "Content-Type: application/json" \
  -d '{
    "memoryIds": ["memory1", "memory2", "memory3"],
    "context": { "workspace": "/path/to/project" }
  }'
```

#### Memory Versioning
Track changes and maintain history:
- Each memory includes creation and update timestamps
- Execution history is maintained for the last 10 runs
- Quality metrics are tracked over time
- Rollback to previous versions is supported

## Project Structure

```
cursor-telemetry/
├── components/
│   ├── dashboard/                 # Main dashboard application
│   │   ├── src/
│   │   │   ├── web-interface/    # Frontend components
│   │   │   ├── services/         # Backend services
│   │   │   └── data-processing/  # Data analysis
│   │   ├── assets/               # Static assets
│   │   └── generated-notebooks/  # Generated artifacts
│   ├── activity-logger/          # Companion monitoring service
│   ├── api/                      # API definitions
│   ├── storage/                  # Data storage
│   └── scripts/                  # Utility scripts
├── snapshots/                    # Session snapshots
├── exports/                      # Data exports
└── docs/                        # Documentation
```

## Configuration

### Environment Variables
- `PORT`: Dashboard server port (default: 3000)
- `COMPANION_PORT`: Companion service port (default: 43918)
- `DATA_PATH`: Data storage path
- `LOG_LEVEL`: Logging verbosity

### Dashboard Settings
- **Privacy Mode**: Configurable data retention and anonymization
- **Real-time Updates**: Toggle live monitoring
- **Memory Generation**: Enable/disable automatic memory creation
- **Analysis Depth**: Adjust classification granularity

## Performance & Monitoring

### Metrics Tracked
- **Session Duration**: Development session length
- **Code Changes**: Number of modifications per session
- **Classification Accuracy**: Cell stage classification confidence
- **Memory Quality**: V-measure completeness scores
- **System Performance**: Response times and resource usage

### Optimization Features
- **Lazy Loading**: On-demand data loading
- **Caching**: Intelligent data caching
- **Compression**: Efficient data storage
- **Background Processing**: Non-blocking analysis

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## SDK Usage

### JavaScript/TypeScript SDK

```typescript
import { CursorTelemetryAPI } from '@cursor-telemetry/sdk';

const api = new CursorTelemetryAPI({
  baseUrl: 'http://localhost:3000',
  apiKey: 'your-api-key'
});

// Connect to real-time updates
await api.connect();

// Access services
const sessions = await api.sessions.getAll();
const memories = await api.memory.search('data analysis');

// Privacy controls
const privacyConfig = await api.privacy.getPrivacyConfig();
await api.privacy.updatePrivacyConfig({ 
  redactionLevel: 0.8,
  sensitivityLevel: 'high' 
});

// Activity logger integration
const status = await api.activityLogger.getStatus();
const stats = await api.activityLogger.getStats();
```

### Python SDK

```python
import cursor_telemetry

# Quick start
api = cursor_telemetry.quick_start('http://localhost:3000')

# Access services
sessions = api.sessions.get_all()
memories = api.memory.search('data analysis')

# Privacy controls
privacy_config = api.privacy.get_config()
api.privacy.update_config({
    'redaction_level': 0.8,
    'sensitivity_level': 'high'
})

# Activity logger integration
status = api.activity_logger.get_status()
stats = api.activity_logger.get_stats()
```

## Related Projects

- [Cursor IDE](https://cursor.sh/) - AI-powered code editor
- [Clio](https://github.com/openclio/clio) - Faceted analysis framework
- [D3.js](https://d3js.org/) - Data visualization library

## Support

For questions, issues, or contributions, please:
- Open an issue on GitHub
- Check the documentation in `/docs`
- Review the API reference above
- Read `PRIVACY_CONTROLS_ANALYSIS.md` for privacy considerations

---

**Note**: This dashboard is designed specifically for data science workflows and provides specialized insights into Jupyter notebook-based development patterns. The system is optimized for macOS, Cursor IDE integration, and requires .ipynb files for full functionality.

**Privacy Warning**: The current privacy controls are not connected to data capture. All data is captured regardless of privacy settings. See `PRIVACY_CONTROLS_ANALYSIS.md` for details.