# PKL Dashboard

A comprehensive dashboard system for Cursor activity logging and dynamic integration with V-measure completeness metrics.

## Components

### Dashboard (`components/dashboard/`)
Main dashboard application with dynamic cursor integration.

- **Features**: V-measure completeness metrics, memory management, notebook generation
- **Tech Stack**: Node.js, Express, Socket.IO
- **Key Files**: 
  - `index.html` - Main dashboard interface
  - `src/web-interface/web-server.js` - Express server
  - `src/services/dynamic-cursor-integration.js` - Core integration service
  - `assets/css/dashboard.css` - Styling

### Activity Logger (`components/activity-logger/`)
Companion service for monitoring Cursor activity.

- **Features**: File watching, diff detection, MCP integration
- **Key Files**:
  - `companion/src/index.js` - Main companion service
  - `public/` - Dashboard assets

### API (`components/api/`)
API endpoints and services.

### Storage (`components/storage/`)
Data storage and database management.

### Scripts (`components/scripts/`)
Utility scripts for data analysis and export.

### Documentation (`components/docs/`)
Project documentation and guides.

## Quick Start

1. Install dependencies:
```bash
cd components/dashboard
npm install
```

2. Start the dashboard:
```bash
npm start
```

3. Access the dashboard at `http://localhost:3000`

## Architecture

The system uses a component-based architecture with:

- **Dynamic Integration**: Replaces AppleScript with V-measure based clustering evaluation
- **Memory Management**: Enhanced memory system with quality metrics
- **Real-time Updates**: WebSocket-based live updates
- **Modular Design**: Separated concerns across components

## V-Measure Implementation

Completeness metrics are based on Rosenberg and Hirschberg (2007) clustering evaluation:

- **Completeness**: Measures how well ground truth labels are clustered together
- **Homogeneity**: Measures cluster purity
- **V-Measure**: Harmonic mean of completeness and homogeneity

## Development

The codebase is organized by component with clean separation of concerns:

- No emojis in code or UI
- Minimal, focused comments
- Clean CSS with CSS variables
- Modular JavaScript architecture
- Comprehensive error handlingx