/**
 * AST Analysis Component
 * 
 * This module provides AST parsing and analysis capabilities using ast-grep
 * for comprehensive code structure analysis and pattern matching.
 */

const ASTGrepService = require('./ast-grep-service');
const ASTGrepIntegration = require('./ast-grep-integration');

module.exports = {
  ASTGrepService,
  ASTGrepIntegration
};
