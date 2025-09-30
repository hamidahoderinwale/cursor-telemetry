# Cursor Telemetry SDK

Official SDK for the Cursor Telemetry Dashboard API - providing programmatic access to all monitoring, analysis, and integration capabilities.

## Quick Start

### JavaScript/TypeScript

```bash
npm install @cursor-telemetry/sdk
```

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
```

### Python

```bash
pip install cursor-telemetry-sdk
```

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
```

## Documentation

- [API Reference](https://docs.cursor-telemetry.com/api)
- [SDK Guide](https://docs.cursor-telemetry.com/sdk)
- [Examples](https://docs.cursor-telemetry.com/examples)
- [Changelog](https://docs.cursor-telemetry.com/changelog)

## Features

- **Real-time Monitoring**: WebSocket support for live updates
- **Session Management**: Create, retrieve, and analyze development sessions
- **Memory Generation**: Convert sessions into executable artifacts
- **Advanced Analytics**: Cell-stage classification and workflow insights
- **Data Export**: Export data in multiple formats
- **Authentication**: API key and OAuth support
- **TypeScript Support**: Full type definitions
- **Error Handling**: Comprehensive error handling and retry logic

## Packages

- **JavaScript/TypeScript**: `@cursor-telemetry/sdk`
- **Python**: `cursor-telemetry-sdk`
- **CLI**: `@cursor-telemetry/cli`

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

- [GitHub Issues](https://github.com/cursor-telemetry/sdk/issues)
- [Discord Community](https://discord.gg/cursor-telemetry)
- [Documentation](https://docs.cursor-telemetry.com)
