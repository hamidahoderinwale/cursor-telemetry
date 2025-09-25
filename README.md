# Cursor Telemetry Dashboard

A comprehensive real-time dashboard system for monitoring, analyzing, and integrating Cursor IDE activity with advanced data science workflow insights and memory management capabilities.

## Project Overview

The Cursor Telemetry Dashboard is an intelligent monitoring and analysis platform that captures, processes, and visualizes development activities from Cursor IDE. It provides deep insights into data science workflows through advanced cell-stage classification, real-time session tracking, and executable memory generation.

### Key Capabilities

- **Real-time Activity Monitoring**: Live tracking of code changes, file modifications, and development sessions
- **Advanced Cell-Stage Classification**: Granular analysis of notebook cells using AST parsing, Clio facets, and multi-dimensional scoring
- **Memory Generation Engine**: Converts development sessions into executable Cursor memories and Jupyter notebooks
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
│  └── Analytics Dashboard                                   │
├─────────────────────────────────────────────────────────────┤
│  Backend Services (Node.js/Express)                        │
│  ├── Web Server (Express + Socket.IO)                     │
│  ├── Cell Stage Classifier (AST + Clio)                   │
│  ├── Memory Generation Engine                              │
│  ├── File-based Integration Service                        │
│  └── Data Storage (JSON-based)                            │
├─────────────────────────────────────────────────────────────┤
│  Companion Service (Activity Logger)                       │
│  ├── File System Monitoring (Chokidar)                    │
│  ├── Code Delta Detection                                  │
│  ├── Semantic Analysis Engine                              │
│  └── WebSocket Communication                               │
├─────────────────────────────────────────────────────────────┤
│  Integration Layer                                         │
│  ├── Cursor IDE Integration (.cursor-session files)       │
│  ├── Notebook Generation (Jupyter/Colab)                  │
│  └── Memory Export/Import System                           │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Activity Capture**: Companion service monitors file changes and code deltas
2. **Real-time Processing**: WebSocket communication delivers live updates
3. **Cell Classification**: Advanced AST and Clio-based analysis of notebook cells
4. **Memory Generation**: Conversion of sessions into executable artifacts
5. **Context Restoration**: File-based integration with Cursor IDE

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

#### Memory Generation
- `POST /api/session/:id/generate-notebook` - Generate executable notebook
- `POST /api/session/:id/create-session-file` - Create .cursor-session file
- `POST /api/session/:id/create-integration-package` - Create complete package

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
cd components/activity-logger
npm start
```

2. **Enable file monitoring**:
The companion service will automatically start monitoring your development directories.

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

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Related Projects

- [Cursor IDE](https://cursor.sh/) - AI-powered code editor
- [Clio](https://github.com/openclio/clio) - Faceted analysis framework
- [D3.js](https://d3js.org/) - Data visualization library

## Support

For questions, issues, or contributions, please:
- Open an issue on GitHub
- Check the documentation in `/docs`
- Review the API reference above

---

**Note**: This dashboard is designed for data science workflows and provides specialized insights into notebook-based development patterns. The system is optimized for macOS and Cursor IDE integration.