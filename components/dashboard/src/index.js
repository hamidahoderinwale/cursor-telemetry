/**
 * PKL Extension - Main Entry Point
 * 
 * This is the main entry point for the PKL Extension system, providing
 * access to all components and their functionality.
 */

// Import all components
const IntentClassification = require('./intent-classification');

// Optional components (may require external dependencies)
let ASTAnalysis = null;
let ClioIntegration = null;
let DataProcessing = null;
let WebInterface = null;
let Testing = null;

try {
  ASTAnalysis = require('./ast-analysis');
} catch (error) {
  console.log('AST Analysis component not available:', error.message);
}

try {
  ClioIntegration = require('./clio-integration');
} catch (error) {
  console.log('Clio Integration component not available:', error.message);
}

try {
  DataProcessing = require('./data-processing');
} catch (error) {
  console.log('Data Processing component not available:', error.message);
}

try {
  WebInterface = require('./web-interface');
} catch (error) {
  console.log('Web Interface component not available:', error.message);
}

try {
  Testing = require('./testing');
} catch (error) {
  console.log('Testing component not available:', error.message);
}

module.exports = {
  // Core components
  IntentClassification,
  ASTAnalysis,
  ClioIntegration,
  DataProcessing,
  WebInterface,
  
  // Testing utilities
  Testing,
  
  // Convenience exports (only if components are available)
  ClioIntentService: IntentClassification.ClioIntentService,
  ASTIntentClassifier: IntentClassification.ASTIntentClassifier,
  ...(ASTAnalysis && {
    ASTGrepService: ASTAnalysis.ASTGrepService,
    ASTGrepIntegration: ASTAnalysis.ASTGrepIntegration
  }),
  ...(DataProcessing && {
    DataStorage: DataProcessing.DataStorage,
    JupyterParser: DataProcessing.JupyterParser,
    ProcedurePatterns: DataProcessing.ProcedurePatterns,
    ExportService: DataProcessing.ExportService,
    PrivacyService: DataProcessing.PrivacyService
  }),
  ...(WebInterface && {
    WebServer: WebInterface.WebServer,
    RealMonitor: WebInterface.RealMonitor,
    KuraDashboard: WebInterface.KuraDashboard
  })
};
