# Cursor Telemetry API & SDK

A comprehensive API and SDK ecosystem for the Cursor Telemetry Dashboard, providing programmatic access to all monitoring, analysis, and integration capabilities.

## API Overview

The Cursor Telemetry API provides RESTful endpoints for:
- **Session Management** - Create, retrieve, and analyze development sessions
- **Project Organization** - Project discovery and session correlation
- **Memory Generation** - Convert sessions into executable artifacts
- **Real-time Analytics** - Live monitoring and visualization data
- **Advanced Analysis** - Kura/Clio integration for deep insights
- **Privacy Controls** - Configurable data anonymization
- **Export Services** - Data export and integration packages

## Base URL

```
http://localhost:3000/api
```

## Authentication

Currently uses session-based authentication. API key authentication coming soon.

## Rate Limiting

- **Standard endpoints**: 100 requests/minute
- **Analysis endpoints**: 10 requests/minute  
- **Export endpoints**: 5 requests/minute

## SDKs Available

- **JavaScript/Node.js** - Full-featured SDK with TypeScript support
- **Python** - Data science focused SDK
- **REST Client** - Generic HTTP client examples

## Quick Start

### JavaScript SDK

```javascript
import { CursorTelemetryAPI } from '@cursor-telemetry/sdk';

const api = new CursorTelemetryAPI({
  baseUrl: 'http://localhost:3000',
  apiKey: 'your-api-key'
});

// Get all sessions
const sessions = await api.sessions.getAll();

// Generate notebook from session
const notebook = await api.sessions.generateNotebook('session-id');

// Get real-time analytics
const analytics = await api.analytics.getLive();

// Get conversations for a session
const conversations = await api.conversations.getAll({ session_id: 'session-id' });

// Get prompt analytics
const promptAnalytics = await api.prompts.getAnalytics({ date_range: 'month' });
```

### Python SDK

```python
from cursor_telemetry import CursorTelemetryAPI

api = CursorTelemetryAPI(
    base_url="http://localhost:3000",
    api_key="your-api-key"
)

# Get sessions
sessions = api.sessions.get_all()

# Generate notebook
notebook = api.sessions.generate_notebook("session-id")

# Get analytics
analytics = api.analytics.get_live()

# Get conversations for a session
conversations = api.get_conversations(session_id='session-id')

# Get prompt analytics
prompt_analytics = api.get_prompt_analytics(date_range='month')
```

## API Categories

### 1. Sessions API
- `GET /sessions` - List all sessions
- `GET /sessions/search` - Search sessions
- `GET /sessions/:id` - Get session details
- `POST /sessions/:id/generate-notebook` - Generate executable notebook
- `POST /sessions/:id/create-session-file` - Create .cursor-session file

### 2. Projects API  
- `GET /projects` - List all projects
- `GET /projects/:id` - Get project details
- `GET /projects/:id/sessions` - Get project sessions

### 3. Analytics API
- `GET /stats` - Get system statistics
- `GET /visualizations` - Get visualization data
- `GET /events` - Get development events
- `GET /embeddings` - Get session embeddings

### 4. Memory API
- `POST /sessions/:id/integrate` - Dynamic session integration
- `POST /sessions/:id/create-memory` - Create executable memory
- `GET /memories` - List all memories
- `POST /memories/:id/execute` - Execute memory

### 5. Export API
- `POST /export` - Export data
- `GET /export/list` - List exports
- `GET /export/download/:filename` - Download export

### 6. Analysis API
- `POST /sessions/analyze-with-kura` - Kura analysis
- `POST /sessions/analyze-with-clio` - Clio analysis
- `GET /procedures/patterns` - Get procedure patterns
- `POST /procedures/execute` - Execute procedure

### 7. Privacy API
- `POST /privacy/analyze` - Privacy analysis
- `POST /privacy/config` - Update privacy config

### 8. Conversations API
- `GET /conversations` - List all conversations
- `GET /conversations/{id}` - Get conversation by ID
- `POST /conversations` - Create conversation
- `PUT /conversations/{id}` - Update conversation
- `DELETE /conversations/{id}` - Delete conversation
- `GET /conversations/search` - Search conversations
- `GET /conversations/analytics` - Get conversation analytics

### 9. Prompts API
- `GET /prompts` - List all prompts
- `GET /prompts/{id}` - Get prompt by ID
- `POST /prompts` - Create prompt
- `GET /prompts/analytics` - Get prompt analytics

## WebSocket Events

Real-time updates via Socket.IO:

### Client → Server
- `session-update` - Update session data
- `request-analysis` - Request new analysis
- `subscribe-events` - Subscribe to real-time updates

### Server → Client
- `sessions-updated` - Session data changes
- `session-created` - New session detected
- `file-changed` - File modification detected
- `analysis-complete` - Analysis results ready

## Error Handling

All API responses follow this format:

```json
{
  "success": true|false,
  "data": {...},
  "error": "Error message if success: false",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Status Codes

- `200` - Success
- `400` - Bad Request
- `401` - Unauthorized
- `404` - Not Found
- `429` - Rate Limited
- `500` - Internal Server Error

## SDK Installation

### JavaScript/Node.js
```bash
npm install @cursor-telemetry/sdk
```

### Python
```bash
pip install cursor-telemetry-sdk
```

## Examples

See `/examples` directory for comprehensive usage examples in multiple languages.

## Support

- **Documentation**: [API Docs](http://localhost:3000/api-docs)
- **Issues**: GitHub Issues
- **Discord**: Community Support
