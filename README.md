# PKL Dashboard - Procedural Knowledge Library

A comprehensive real-time monitoring and analysis system for Cursor IDE sessions, with advanced privacy-preserving workflow analysis capabilities.

## Overview

The PKL Dashboard is a sophisticated monitoring system that tracks and analyzes user interactions with Cursor IDE, particularly focusing on Jupyter notebook development workflows. It provides real-time insights into coding patterns, session analytics, and privacy-preserving analysis of development activities.

## Key Features

### Real-time Monitoring
- Live tracking of Cursor IDE sessions
- Real-time file change detection
- Active session monitoring with duration tracking
- Conversation capture and analysis

### Privacy-Preserving Analysis
- Differential privacy implementation with configurable epsilon values
- Token-level redaction with adjustable sensitivity
- Procedural abstraction at multiple levels (token, statement, function, module, workflow)
- Privacy-expressiveness trade-off visualization

### Advanced Analytics
- Workflow pattern clustering using Kura integration
- Multi-dimensional analysis with OpenClio
- Session intent classification (explore, implement, debug, refactor)
- Code change tracking and visualization

### Interactive Dashboard
- Modern, responsive web interface
- Real-time data updates via WebSocket
- Interactive visualizations and charts
- Export capabilities for analysis results

## Technical Architecture

### Backend Components
- **Node.js Web Server**: Express-based API server running on port 3000
- **Python Analysis Engine**: Flask-based analysis API with Kura and OpenClio integration
- **SQLite Database**: Local storage for session data and analysis results
- **File System Monitor**: Real-time tracking of notebook and file changes

### Frontend Components
- **React-based Dashboard**: Modern web interface with real-time updates
- **Privacy Analysis Interface**: Interactive controls for privacy configuration
- **Visualization Components**: Charts, graphs, and cluster visualizations
- **Export System**: Multiple format support (JSON, CSV, PDF)

### Integration Services
- **Kura Integration**: Conversation clustering and pattern discovery
- **OpenClio Integration**: Multi-dimensional facet analysis
- **Cursor IDE Integration**: Real-time activity monitoring
- **Jupyter Notebook Parser**: Specialized analysis for notebook workflows

## Installation and Setup

### Prerequisites
- Node.js 18.0.0 or higher
- Python 3.8 or higher
- SQLite3
- OpenAI API key (for Kura/OpenClio integration)

### Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd cursor_dashboard
   ```

2. **Install Node.js dependencies**
   ```bash
   cd cursor-pkl-extension
   npm install
   ```

3. **Install Python dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env and add your OpenAI API key
   ```

5. **Start the services**
   ```bash
   # Start the main dashboard
   cd cursor-pkl-extension
   npm start
   
   # In another terminal, start the analysis engine
   python main.py
   ```

6. **Access the dashboard**
   Open your browser to `http://localhost:3000`

## Configuration

### Privacy Settings
The system supports extensive privacy configuration:

- **Differential Privacy (ε)**: Controls the privacy budget (0.1 to 10.0)
- **Token Redaction Level**: Percentage of tokens to redact (0% to 100%)
- **Procedural Abstraction**: Level of abstraction (1-5)
- **Redaction Options**: Names, numbers, email addresses

### Analysis Parameters
- **Clustering Quality**: Silhouette score calculation
- **Classification Accuracy**: Intent prediction accuracy
- **Workflow Preservation**: Shape preservation metrics
- **Information Retention**: Data retention analysis

## API Endpoints

### Session Management
- `GET /api/sessions` - Retrieve all sessions
- `GET /api/session/:id` - Get specific session details
- `GET /api/session/:id/conversations` - Get session conversations

### Analysis Endpoints
- `GET /api/analysis/status` - Analysis system status
- `GET /api/analysis/conversations` - Conversation analysis
- `GET /api/analysis/kura/clusters` - Kura clustering results
- `GET /api/analysis/openclio/facets` - OpenClio facet analysis

### Export Endpoints
- `POST /api/export/sessions` - Export session data
- `POST /api/export/analysis` - Export analysis results
- `POST /api/export/privacy` - Export privacy analysis

## Data Models

### Session Model
```json
{
  "id": "session_id",
  "timestamp": "2024-01-01T00:00:00Z",
  "intent": "explore|implement|debug|refactor",
  "outcome": "completed|in-progress|failed",
  "duration": 3600,
  "fileChanges": [...],
  "codeDeltas": [...],
  "conversations": [...]
}
```

### Privacy Configuration
```json
{
  "epsilon": 1.0,
  "redactionLevel": 50,
  "abstractionLevel": 3,
  "redactNames": true,
  "redactNumbers": true,
  "redactEmails": true
}
```

## Privacy and Security

### Data Protection
- All sensitive data is processed with differential privacy
- Configurable redaction levels for different data types
- Local storage with no external data transmission
- Optional anonymization of session identifiers

### Compliance
- GDPR-compliant data processing
- Configurable data retention policies
- User consent mechanisms
- Data export and deletion capabilities

## Development

### Project Structure
```
cursor_dashboard/
├── cursor-pkl-extension/          # Main Node.js application
│   ├── components/                # UI components
│   ├── assets/                    # Static assets
│   └── web-server.js             # Main server file
├── src/                          # Python analysis engine
│   ├── analysis/                 # Analysis modules
│   ├── api/                      # API endpoints
│   └── adapters/                 # Data adapters
├── docs/                         # Documentation
└── tests/                        # Test files
```

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

### Testing
```bash
# Run Node.js tests
npm test

# Run Python tests
python -m pytest tests/

# Run integration tests
npm run test:integration
```

## Troubleshooting

### Common Issues

**Dashboard not loading**
- Check if Node.js server is running on port 3000
- Verify all dependencies are installed
- Check browser console for errors

**Analysis not working**
- Ensure Python analysis engine is running
- Verify OpenAI API key is configured
- Check Python dependencies are installed

**Privacy analysis errors**
- Verify Kura and OpenClio are properly installed
- Check API key configuration
- Ensure sufficient system resources

### Performance Optimization
- Adjust privacy parameters for better performance
- Use appropriate abstraction levels
- Monitor system resource usage
- Configure appropriate data retention policies

## License

This project is licensed under the MIT License. See the LICENSE file for details.

## Support

For support and questions:
- Create an issue in the repository
- Check the documentation in the `docs/` folder
- Review the troubleshooting section

## Changelog

### Version 2.0.0
- Added privacy-preserving analysis capabilities
- Integrated Kura and OpenClio for advanced analytics
- Implemented real-time WebSocket communication
- Added comprehensive export functionality
- Enhanced UI with modern design system

### Version 1.0.0
- Initial release with basic session monitoring
- Jupyter notebook tracking
- Simple dashboard interface
- Basic analytics and visualization