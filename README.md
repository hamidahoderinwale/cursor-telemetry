# Cursor Telemetry Dashboard

A comprehensive real-time dashboard system for monitoring, analyzing, and integrating Cursor IDE activity with advanced data science workflow insights and memory management capabilities. **Specifically designed for Jupyter notebook users working in Cursor IDE.**

## Overview

The Cursor Telemetry Dashboard is an intelligent monitoring and analysis platform that captures, processes, and visualizes development activities from Cursor IDE. It provides deep insights into data science workflows through advanced cell-stage classification, real-time session tracking, and executable memory generation.

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

### Data Flow

1. **Activity Capture**: Companion service (port 43917) monitors file changes, clipboard, and DOM changes
2. **Real-time Processing**: WebSocket communication delivers live updates to dashboard (port 3000)
3. **Cell Classification**: Advanced AST and Clio-based analysis of notebook cells
4. **Memory Generation**: Conversion of sessions into executable artifacts
5. **Privacy Processing**: Post-capture privacy transformations (not connected to capture)
6. **Context Restoration**: File-based integration with Cursor IDE

## Tech Stack

### Frontend
- **D3.js**: Data visualization and interactive charts
- **Socket.IO Client**: Real-time communication


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

### Cell-Stage Classification

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

#### Memory Commands (Chat Interface)
- `@memory create from session {sessionId}` - Create memory from session
- `@memory search {query}` - Search memories
- `@memory execute {memoryId}` - Execute a memory
- `@memory list` - List all memories
- `@memory stats` - Show memory statistics
- `@memory export` - Export all memories
- `@memory delete {memoryId}` - Delete a memory

### Memory Quality Metrics

- **Completeness Score (0-1)**: How complete the memory capture is
- **V-Measure Score (0-1)**: Clustering quality and homogeneity
- **File Coverage**: Percentage of relevant files captured
- **Analysis Depth**: Level of analysis performed
- **Execution Success Rate**: How often the memory executes successfully

## API Reference

### Core Endpoints

#### Sessions
- `GET /api/sessions` - Retrieve all sessions
- `GET /api/sessions/search?q={query}` - Search sessions
- `GET /api/session/:id` - Get specific session details

#### Memory Management
- `GET /api/memories` - Retrieve all memories with filtering
- `GET /api/memories/search?q={query}` - Search memories by content
- `GET /api/memories/stats` - Get memory statistics and metrics
- `POST /api/memories/:id/execute` - Execute a stored memory
- `PUT /api/memories/:id` - Update memory metadata
- `DELETE /api/memories/:id` - Delete a memory
- `POST /api/memories/export` - Export memories in JSON/CSV format
- `POST /api/memories/import` - Import memories from file

#### Memory Generation
- `POST /api/session/:id/generate-notebook` - Generate executable notebook
- `POST /api/session/:id/create-session-file` - Create .cursor-session file
- `POST /api/session/:id/create-integration-package` - Create complete package
- `POST /api/session/:id/create-memory` - Create executable memory from session

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

## Data Capture & Information Types

The Cursor Telemetry Dashboard captures comprehensive information about your development activities through multiple monitoring mechanisms. Understanding what data is captured is crucial for privacy and security.

### Data Capture Sources

#### 1. **Clipboard Monitoring**
- **What's Captured**: Complete clipboard content when copied
- **Frequency**: Every 10 seconds (configurable)
- **Data Types**: 
  - Code snippets, prompts, responses
  - API keys, passwords, tokens
  - Personal information, file paths
  - Any text copied to clipboard
- **Storage**: Raw text stored in database
- **Privacy**: No filtering applied by default

#### 2. **MCP (Model Context Protocol) Integration**
- **What's Captured**: Direct communication from Cursor IDE
- **Data Types**:
  - Complete prompt/response pairs
  - File paths and context
  - Code changes (before/after)
  - Session information
- **Storage**: Full conversation history
- **Privacy**: No redaction applied

#### 3. **File System Monitoring**
- **What's Captured**: File changes and modifications
- **Data Types**:
  - Complete file contents (before/after)
  - File paths (including usernames)
  - Code diffs and changes
  - Configuration files
- **Storage**: Full file content snapshots
- **Privacy**: No path anonymization

#### 4. **DOM Monitoring**
- **What's Captured**: Web page content and interactions
- **Data Types**:
  - Form inputs and selections
  - Page content and structure
  - User interactions
- **Storage**: HTML content and metadata
- **Privacy**: No content filtering

#### 5. **Cursor Database Mining**
- **What's Captured**: Direct extraction from Cursor's internal SQLite databases
- **Source Location**: `~/Library/Application Support/Cursor/User/workspaceStorage/*/state.vscdb`
- **Data Types**:
  - **AI Conversation Titles**: Complete prompt/conversation names from Composer
  - **Code Impact Metrics**: Lines added/removed per conversation (aggregated)
  - **Context Usage**: Percentage of context window utilized per prompt
  - **AI Mode Information**: Agent/Chat/Edit mode, model type (Claude 4.5 Sonnet inferred)
  - **Workspace Context**: Workspace paths, friendly names, and session IDs
  - **Temporal Data**: Creation/update timestamps for linking to code changes
- **Metadata Captured**:
  ```javascript
  {
    "text": "Implementing user authentication system",
    "workspacePath": "/Users/dev/project",
    "linesAdded": 247,
    "linesRemoved": 83,
    "contextUsage": 67.5,
    "mode": "agent",
    "modelName": "claude-4.5-sonnet",
    "composerId": "uuid-12345",
    "timestamp": 1729814400000
  }
  ```
- **Update Frequency**: Every 10 seconds via database polling
- **Linkage**: Prompts automatically linked to subsequent code changes for traceability
- **Storage**: Extended SQLite schema with 16+ metadata fields per prompt
- **Privacy**: Full conversation history with no filtering

### Information Types Captured

#### **Code & Development Data**
```javascript
{
  "file_path": "/Users/john.smith/projects/auth/src/auth.js",
  "before_code": "const auth = require('auth');",
  "after_code": "const jwt = require('jsonwebtoken');\nconst auth = require('auth');",
  "prompt": "How do I implement JWT authentication?",
  "response": "Here's how to implement JWT authentication...",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### **Sensitive Information**
- **API Keys**: GitHub tokens, AWS credentials, Stripe keys
- **Passwords**: Database passwords, service credentials
- **Personal Data**: Names, emails, phone numbers
- **Business Information**: Company names, project details
- **System Information**: Usernames, file paths, directory structure

#### **Security & Privacy Data**
- **Authentication Tokens**: JWT secrets, OAuth tokens
- **Database Credentials**: Connection strings, passwords
- **Private Keys**: SSH keys, encryption keys
- **Environment Variables**: Complete .env file contents
- **Configuration Files**: API keys, secrets, credentials

### Data Storage & Retention

#### **Storage Format**
- **Database**: SQLite (`companion.db`) with full text storage
- **Format**: Plain text (no encryption)
- **Retention**: Indefinite (no automatic cleanup)
- **Access**: No authentication required
- **Schema**:
  - **entries**: File changes with before/after code, prompt linkage
  - **prompts**: Enhanced metadata (16 fields) including AI mode, context usage, code impact
  - **events**: Activity timeline with detailed event metadata
- **Location**: `components/activity-logger/companion/data/companion.db`

#### **Data Volume**
- **Per Session**: 10-50MB of raw data
- **Clipboard Entries**: 50-200 per session
- **File Changes**: 20-100 per session (tracked in entries table)
- **MCP Entries**: 30-150 per session
- **AI Prompts**: 20-100 per session with full metadata
- **Database Growth**: ~5-10MB per hour of active development

### Security Detection & Analytics

The system includes advanced security detection capabilities:

#### **Secret Detection Patterns**
- **GitHub Tokens**: `ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_`
- **AWS Credentials**: Access keys, secret keys
- **Database URLs**: PostgreSQL, MySQL, MongoDB
- **JWT Secrets**: Authentication tokens
- **Private Keys**: RSA, DSA, EC, OpenSSH
- **API Keys**: Google, Stripe, Slack, etc.

#### **Security Analytics**
```bash
# Get security analytics
curl "http://localhost:3000/api/security/analytics"

# Get JWT secret count
curl "http://localhost:3000/api/security/issues/jwt_secret"

# Get critical issues
curl "http://localhost:3000/api/security/critical"
```

#### **Risk Assessment**
- **Risk Scoring**: 0-100 scale based on detected secrets
- **Severity Levels**: Critical, High, Medium, Low
- **Recommendations**: Actionable security advice
- **Trend Analysis**: Security posture over time

### Privacy Controls

#### **Current Limitations**
- **No Default Protection**: All data captured without filtering
- **No Encryption**: Plain text storage
- **No Access Controls**: Open API endpoints
- **No Retention Limits**: Indefinite storage

#### **Available Controls**
```javascript
// Privacy configuration (optional)
const privacyConfig = {
  enabled: false,              // DISABLED by default
  redactNames: false,         // NO name redaction
  redactNumbers: false,       // NO number redaction
  redactEmails: false,        // NO email redaction
  redactFilePaths: false      // NO path redaction
};
```

#### **Security Recommendations**
1. **Enable Privacy Controls**: Configure data redaction
2. **Regular Security Audits**: Use security analytics API
3. **Data Cleanup**: Implement retention policies
4. **Access Controls**: Secure API endpoints
5. **Encryption**: Implement data encryption

### Data Export & Analysis

#### **Export Capabilities**
```bash
# Export all data
curl "http://localhost:3000/api/export/json"

# Export security report
curl "http://localhost:3000/api/security/analytics" > security-report.json

# Export conversations
curl "http://localhost:3000/api/conversations"
```

#### **Analytics Endpoints**
- **Security Analytics**: `/api/security/analytics`
- **Conversation Analytics**: `/api/conversations/analytics`
- **Prompt Analytics**: `/api/prompts/analytics`
- **Risk Assessment**: `/api/security/risk-assessment`

## Privacy Considerations

**Critical**: The system captures sensitive data with no privacy protection by default:

1. **Review Captured Data**: Check what information is being stored
2. **Enable Privacy Controls**: Configure data redaction and filtering
3. **Monitor Security Issues**: Use security analytics to identify risks
4. **Implement Data Policies**: Set retention limits and access controls
5. **Regular Audits**: Review captured data for sensitive information

**Security Warning**: The system captures API keys, passwords, personal information, and business data in plain text with no encryption or access controls.

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

**Privacy Warning**: The current privacy controls are not connected to data capture. All data is captured regardless of privacy settings. See `PRIVACY_CONTROLS_ANALYSIS.md` for details.// Test change for companion service
