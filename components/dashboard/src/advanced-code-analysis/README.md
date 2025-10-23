# Advanced Code Analysis System

A comprehensive code analysis and intelligence system inspired by Shadow's sophisticated architecture, designed to enhance the cursor-telemetry dashboard with deep code understanding capabilities.

## Overview

This system provides advanced code analysis, semantic search, memory generation, and context restoration capabilities that transform your dashboard into an intelligent development platform.

## Components

### Core Analysis Modules

1. **`enhanced-ast-analyzer.js`** - Multi-language AST parsing and analysis
2. **`semantic-search-engine.js`** - Vector-based semantic code search
3. **`hierarchical-documentation-generator.js`** - Multi-level codebase documentation
4. **`enhanced-memory-generator.js`** - Intelligent memory creation and management
5. **`enhanced-context-restoration.js`** - File-based context recovery
6. **`advanced-code-analysis-integration.js`** - Unified API for all components
7. **`enhanced-dashboard-integration.js`** - Dashboard integration layer

### Documentation

- **`IMPLEMENTATION_GUIDE.md`** - Step-by-step implementation guide with examples
- **`README.md`** - This file

## Quick Start

```javascript
// Initialize the enhanced dashboard
const EnhancedDashboardIntegration = require('./advanced-code-analysis/enhanced-dashboard-integration');

const enhancedDashboard = new EnhancedDashboardIntegration({
  enableRealTimeAnalysis: true,
  enableSemanticSearch: true,
  enableMemoryGeneration: true,
  enableDocumentationGeneration: true
});

// Start real-time analysis
enhancedDashboard.startRealTimeAnalysis();

// Perform semantic search
await enhancedDashboard.performSemanticSearch('authentication logic');

// Analyze a session
await enhancedDashboard.analyzeSession(sessionData);

// Restore context
await enhancedDashboard.restoreContext(sessionData);
```

## Key Features

### 1. Semantic Code Search
- Vector-based similarity search
- Natural language queries
- Context-aware results
- Relationship mapping

### 2. Advanced AST Analysis
- Multi-language support (JS, TS, Python, Java, C++, Go, Rust, PHP, Ruby)
- Symbol extraction and mapping
- Relationship graph construction
- Complexity analysis

### 3. Hierarchical Documentation
- Repository-level overview
- Directory-level summaries
- File-level documentation
- Automatic architecture detection

### 4. Memory Generation
- Session-level memories
- File-level memories
- Function-level memories
- Concept-level memories
- Hierarchical memory relationships

### 5. Context Restoration
- File-based restoration
- Session state reconstruction
- Memory-driven recovery
- Real-time synchronization

### 6. Dashboard Integration
- Real-time analysis pipeline
- Event-driven updates
- Performance optimization
- Advanced visualizations

## Dashboard Enhancements

### New Views

1. **Semantic Code Search** - Intelligent code search interface
2. **Code Relationships** - Visual relationship graphs
3. **Memory Hierarchy** - Hierarchical memory exploration
4. **Codebase Explorer** - Interactive codebase documentation
5. **Enhanced Session Analysis** - Deep session insights

### Enhanced Features

1. **Session Cards** - Enhanced with memory indicators and complexity metrics
2. **Timeline View** - Enriched with code analysis data
3. **Search** - Semantic search capabilities
4. **Context Restoration** - One-click context recovery

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              Enhanced Dashboard Integration                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │   Advanced Code Analysis Integration                 │   │
│  │                                                       │   │
│  │  ┌──────────────┐  ┌───────────────┐  ┌──────────┐  │   │
│  │  │ AST Analyzer │  │ Semantic      │  │ Doc      │  │   │
│  │  │              │  │ Search Engine │  │ Generator│  │   │
│  │  └──────────────┘  └───────────────┘  └──────────┘  │   │
│  │                                                       │   │
│  │  ┌──────────────┐  ┌───────────────┐                │   │
│  │  │ Memory       │  │ Context       │                │   │
│  │  │ Generator    │  │ Restoration   │                │   │
│  │  └──────────────┘  └───────────────┘                │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                    Dashboard Layer                           │
│  ┌────────────┐ ┌────────────┐ ┌──────────┐ ┌───────────┐  │
│  │ Semantic   │ │ Code       │ │ Memory   │ │ Codebase  │  │
│  │ Search     │ │ Relations  │ │ Hierarchy│ │ Explorer  │  │
│  │ View       │ │ View       │ │ View     │ │ View      │  │
│  └────────────┘ └────────────┘ └──────────┘ └───────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Usage Examples

### Example 1: Analyze Session with Full Insights

```javascript
const session = {
  sessionId: 'session-123',
  files: [
    { path: '/src/auth.js', content: '...' },
    { path: '/src/api.js', content: '...' }
  ],
  changes: [...],
  duration: 3600000
};

const result = await enhancedDashboard.analyzeSession(session, {
  enableAST: true,
  enableSemantic: true,
  enableMemory: true,
  enableDocumentation: true
});

// Access analysis results
const analysisData = enhancedDashboard.getAnalysisResults(result.fileAnalysisTasks[0]);
const memoryData = enhancedDashboard.getMemoryData(session.sessionId);
const contextData = enhancedDashboard.getContextData(session.sessionId);
```

### Example 2: Semantic Search with Filters

```javascript
const searchResults = await enhancedDashboard.performSemanticSearch(
  'how to handle user authentication',
  {
    threshold: 0.3,
    maxResults: 20,
    language: 'javascript'
  }
);

// Results are available through event listener
enhancedDashboard.on('dashboardUpdate', (data) => {
  if (data.type === 'semanticSearch') {
    console.log('Found', data.results.length, 'matches');
    data.results.forEach(result => {
      console.log(`${result.filePath}: ${result.similarity * 100}% match`);
    });
  }
});
```

### Example 3: Generate Codebase Documentation

```javascript
const documentation = await enhancedDashboard.analysisIntegration.generateDocumentation(
  '/path/to/codebase',
  {
    enableSymbolAnalysis: true,
    enableRelationshipMapping: true,
    enableContextualSummarization: true
  }
);

// Access different levels of documentation
const repoOverview = documentation.documentation.repository;
const directoryDocs = documentation.documentation.directories;
const fileDocs = documentation.documentation.files;
```

### Example 4: Restore Context from Previous Session

```javascript
const restoration = await enhancedDashboard.restoreContext(sessionData, {
  enableFileRestoration: true,
  enableSessionRestoration: true,
  enableMemoryRestoration: true
});

console.log('Restored', restoration.files.length, 'files');
console.log('Restored', restoration.memories.length, 'memories');
console.log('Method:', restoration.method);
```

## Event System

The system uses an event-driven architecture for real-time updates:

```javascript
// Dashboard updates
enhancedDashboard.on('dashboardUpdate', (data) => {
  // Handle updates: fileAnalysis, semanticSearch, memoriesGenerated, contextRestored
});

// Analysis completion
enhancedDashboard.on('taskCompleted', (data) => {
  // Handle task completion
});

// Error handling
enhancedDashboard.on('dashboardError', (error) => {
  // Handle errors
});

// Session analysis events
enhancedDashboard.on('sessionAnalysisStarted', (data) => {
  // Handle analysis start
});
```

## Configuration Options

```javascript
const options = {
  // Real-time analysis
  enableRealTimeAnalysis: true,
  analysisInterval: 5000, // 5 seconds
  
  // Feature toggles
  enableSemanticSearch: true,
  enableMemoryGeneration: true,
  enableDocumentationGeneration: true,
  enableContextRestoration: true,
  
  // Performance
  maxCacheSize: 1000,
  maxFileSize: 1024 * 1024, // 1MB
  maxDirectoryDepth: 10,
  
  // Semantic search
  embeddingDimensions: 384,
  maxResults: 50,
  similarityThreshold: 0.3,
  
  // Memory generation
  maxMemorySize: 10000, // 10KB
  memoryLevels: ['session', 'file', 'function', 'concept'],
  
  // Context restoration
  contextTimeout: 300000, // 5 minutes
};
```

## Performance Considerations

1. **Lazy Loading**: Files are analyzed on-demand
2. **Caching**: Analysis results are cached for reuse
3. **Batch Processing**: Multiple files processed in batches
4. **Incremental Updates**: Only changed files are reanalyzed
5. **Memory Management**: Automatic cache cleanup

## Integration with Existing Dashboard

The system seamlessly integrates with your existing dashboard:

1. **Non-Breaking**: Existing functionality remains unchanged
2. **Progressive Enhancement**: Features load progressively
3. **Event-Driven**: Uses event system for updates
4. **Modular**: Components can be enabled/disabled independently

## API Reference

### EnhancedDashboardIntegration

#### Methods

- `startRealTimeAnalysis()` - Start real-time analysis
- `stopRealTimeAnalysis()` - Stop real-time analysis
- `analyzeSession(sessionData, options)` - Analyze session
- `performSemanticSearch(query, options)` - Semantic search
- `restoreContext(sessionData, options)` - Restore context
- `getDashboardState()` - Get current state
- `getStats()` - Get statistics
- `clear()` - Clear all data

#### Events

- `dashboardUpdate` - Dashboard data updated
- `taskCompleted` - Analysis task completed
- `dashboardError` - Error occurred
- `sessionAnalysisStarted` - Session analysis started

## Support and Documentation

- **Implementation Guide**: See `IMPLEMENTATION_GUIDE.md` for detailed examples
- **Component Docs**: Check individual component files for API details
- **Examples**: See usage examples above

## Benefits

1. **Deeper Understanding**: Comprehensive codebase insights
2. **Intelligent Search**: Find code by meaning, not just keywords
3. **Knowledge Management**: Organized development memories
4. **Context Awareness**: Seamless context restoration
5. **Learning Insights**: Track development patterns and progress
6. **Performance**: Optimized for large codebases

## License

Same as cursor-telemetry project

