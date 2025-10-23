/**
 * Advanced Code Analysis System - Main Entry Point
 * 
 * Shadow-inspired code analysis capabilities for cursor-telemetry dashboard
 * 
 * @module advanced-code-analysis
 */

const EnhancedASTAnalyzer = require('./enhanced-ast-analyzer');
const SemanticSearchEngine = require('./semantic-search-engine');
const HierarchicalDocumentationGenerator = require('./hierarchical-documentation-generator');
const EnhancedMemoryGenerator = require('./enhanced-memory-generator');
const EnhancedContextRestoration = require('./enhanced-context-restoration');
const AdvancedCodeAnalysisIntegration = require('./advanced-code-analysis-integration');
const EnhancedDashboardIntegration = require('./enhanced-dashboard-integration');

// Export all components
module.exports = {
  // Core components
  EnhancedASTAnalyzer,
  SemanticSearchEngine,
  HierarchicalDocumentationGenerator,
  EnhancedMemoryGenerator,
  EnhancedContextRestoration,
  
  // Integration layers
  AdvancedCodeAnalysisIntegration,
  EnhancedDashboardIntegration,
  
  // Convenience factory function
  createEnhancedDashboard: (options = {}) => {
    return new EnhancedDashboardIntegration(options);
  },
  
  // Version info
  version: '1.0.0',
  description: 'Shadow-inspired advanced code analysis for cursor-telemetry'
};


