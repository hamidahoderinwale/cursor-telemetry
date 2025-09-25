/**
 * Intent Classification Component
 * 
 * This module provides intent classification capabilities using both AST analysis
 * and OpenClio/Kura integration with configurable facets and toggle percentages.
 */

const ClioIntentService = require('./clio-intent-service');
const ASTIntentClassifier = require('./ast-intent-classifier');

module.exports = {
  ClioIntentService,
  ASTIntentClassifier
};
