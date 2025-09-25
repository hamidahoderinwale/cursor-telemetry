# PKL Extension - Refactored Architecture

## Overview

The PKL Extension has been refactored into a modular, component-based architecture for better maintainability, scalability, and organization. The codebase is now organized into logical components with clear separation of concerns.

## Architecture

```
src/
├── intent-classification/     # Intent classification and facet analysis
├── ast-analysis/             # AST parsing and code structure analysis
├── clio-integration/         # OpenClio and Kura integration
├── data-processing/          # Data storage, parsing, and processing
├── web-interface/           # Web dashboards and monitoring
├── testing/                 # Test suites and validation
├── config/                  # Configuration files
├── documentation/           # Documentation and guides
└── index.js                 # Main entry point
```

## Components

### Intent Classification (`src/intent-classification/`)

**Purpose**: Advanced intent classification using AST analysis and OpenClio/Kura integration.

**Files**:
- `clio-intent-service.js` - Main intent service with enhanced facets
- `ast-intent-classifier.js` - AST-based intent classification
- `index.js` - Component exports

**Features**:
- Multi-faceted intent analysis (intent, task, complexity, domain)
- Configurable toggle percentages
- AST-OpenClio integration
- Hybrid classification with configurable proportions

**Usage**:
```javascript
const { ClioIntentService, ASTIntentClassifier } = require('./src/intent-classification');

const intentService = new ClioIntentService();
const astClassifier = new ASTIntentClassifier(intentService);
```

### AST Analysis (`src/ast-analysis/`)

**Purpose**: Comprehensive AST parsing and code structure analysis using ast-grep.

**Files**:
- `ast-grep-service.js` - Core AST parsing service
- `ast-grep-integration.js` - Enhanced integration with learning
- `ast-grep-config.json` - Configuration for extraction patterns
- `index.js` - Component exports

**Features**:
- Multi-language AST parsing (JavaScript, TypeScript, Python, etc.)
- Function, class, and module extraction
- Pattern-based code analysis
- Real-time code transformation

**Usage**:
```javascript
const { ASTGrepService, ASTGrepIntegration } = require('./src/ast-analysis');

const astService = new ASTGrepService();
const analysis = astService.analyzeSource(code, 'JavaScript');
```

### Clio Integration (`src/clio-integration/`)

**Purpose**: Integration with OpenClio and Kura for advanced conversation analysis.

**Files**:
- `deep_kura_openclio_integration.py` - Deep PKL integration
- `kura_bridge.py` - Kura bridge service
- `native_pkl_integration.py` - Native PKL integration
- `repository_parser.py` - Repository analysis
- `kura-api-endpoint.js` - JavaScript API endpoint
- `index.js` - Component exports

**Features**:
- OpenClio conversation analysis
- Kura procedural knowledge capture
- Repository pattern analysis
- Python-JavaScript bridge

### Data Processing (`src/data-processing/`)

**Purpose**: Data storage, parsing, and processing capabilities.

**Files**:
- `data-storage.js` - Data storage and management
- `jupyter-parser.js` - Jupyter notebook parsing
- `procedure-patterns.js` - Procedure pattern detection
- `export-service.js` - Data export functionality
- `privacy-service.js` - Privacy analysis
- `index.js` - Component exports

**Features**:
- Jupyter notebook analysis
- Procedure pattern recognition
- Data export and privacy analysis
- Storage management

### Web Interface (`src/web-interface/`)

**Purpose**: Web-based dashboards and monitoring interfaces.

**Files**:
- `web-server.js` - Main web server
- `kura-dashboard.js` - Kura dashboard
- `real-monitor.js` - Real-time monitoring
- `kura-dashboard.css` - Dashboard styles
- `kura-enhanced-dashboard.html` - Enhanced dashboard
- `live-dashboard-clean.html` - Clean dashboard
- `index.js` - Component exports

**Features**:
- Real-time monitoring dashboard
- Kura integration interface
- Clean, responsive design
- Live data visualization

### Testing (`src/testing/`)

**Purpose**: Test suites and validation for all components.

**Files**:
- `test-enhanced-facets.js` - Enhanced facets testing
- `test-ast-enhanced-facets.js` - AST enhanced facets testing
- `test-toggle-percentages.js` - Toggle percentages testing
- `index.js` - Test exports

**Features**:
- Comprehensive component testing
- Facet analysis validation
- Toggle percentage testing
- Integration testing

## Quick Start

### Installation

```bash
npm install
```

### Running Tests

```bash
# Test enhanced facets
npm run test:facets

# Test AST enhanced facets
npm run test:ast

# Test toggle percentages
npm run test:toggle

# Run all tests
npm test
```

### Starting the Application

```bash
# Start web server
npm start

# Development mode
npm run dev
```

## Usage Examples

### Basic Intent Classification

```javascript
const { ClioIntentService } = require('./src');

const intentService = new ClioIntentService();

const session = {
  id: 'test-session',
  codeDeltas: [{ afterContent: 'import pandas as pd\ndf = pd.read_csv("data.csv")' }]
};

const result = await intentService.hybridClassifyIntent(session);
console.log('Intent:', result.hybrid.primary_intent);
console.log('Confidence:', result.hybrid.confidence);
```

### AST Analysis

```javascript
const { ASTGrepService } = require('./src');

const astService = new ASTGrepService();
const analysis = astService.analyzeSource(`
function hello() {
  console.log('Hello, World!');
}
`, 'JavaScript');

console.log('Functions:', analysis.functions.length);
console.log('Classes:', analysis.classes.length);
```

### Configuration

```javascript
const { ClioIntentService } = require('./src');

const intentService = new ClioIntentService();

// Set analysis proportions (AST vs Clio)
intentService.setAnalysisProportions(0.7, 0.3, false);

// Update toggle percentages
intentService.updateTogglePercentages('intent', {
  explore: 0.4,
  implement: 0.3,
  debug: 0.2,
  refactor: 0.1,
  document: 0.0
});
```

## Configuration Files

### `src/config/`
- `pkl_integration_spec.json` - PKL integration specification
- `package-ast-grep.json` - AST-Grep package configuration
- `repository_analysis.json` - Repository analysis results

## Documentation

### `src/documentation/`
- `AST_GREP_README.md` - AST-Grep service documentation
- `AST_IMPLEMENTATION_SUMMARY.md` - AST implementation overview
- `INTENT_FACETS_DOCUMENTATION.md` - Intent facets documentation
- `INTENT_FACETS_SUMMARY.md` - Intent facets summary
- `TOGGLE_PERCENTAGES_README.md` - Toggle percentages guide

## Migration Guide

### From Old Structure

**Old**:
```javascript
const ClioIntentService = require('./clio-intent-service');
const ASTIntentClassifier = require('./ast-intent-classifier');
```

**New**:
```javascript
const { ClioIntentService, ASTIntentClassifier } = require('./src');
// or
const { ClioIntentService, ASTIntentClassifier } = require('./src/intent-classification');
```

### Updated Scripts

**Old**:
```bash
node web-server.js
node test-enhanced-facets.js
```

**New**:
```bash
npm start
npm run test:facets
```

## Benefits of Refactoring

1. **Modularity**: Clear separation of concerns with logical component grouping
2. **Maintainability**: Easier to locate and modify specific functionality
3. **Scalability**: Components can be developed and tested independently
4. **Reusability**: Components can be imported and used in different contexts
5. **Testing**: Dedicated testing component with comprehensive test suites
6. **Documentation**: Organized documentation for each component
7. **Configuration**: Centralized configuration management

## Development

### Adding New Components

1. Create a new directory in `src/`
2. Add component files
3. Create an `index.js` file with exports
4. Update `src/index.js` to include the new component
5. Add tests in `src/testing/`
6. Update documentation

### Component Guidelines

- Each component should have a single responsibility
- Components should be loosely coupled
- Use clear, descriptive file and function names
- Include comprehensive error handling
- Add JSDoc comments for all public methods
- Write tests for all functionality

## License

MIT License - see LICENSE file for details.
