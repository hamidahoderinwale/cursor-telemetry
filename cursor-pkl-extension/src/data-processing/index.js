/**
 * Data Processing Component
 * 
 * This module provides data storage, parsing, and processing capabilities
 * for notebooks, procedures, and privacy analysis.
 */

const DataStorage = require('./data-storage.js');
const JupyterParser = require('./jupyter-parser.js');
const ProcedurePatterns = require('./procedure-patterns.js');
const ExportService = require('./export-service.js');
const PrivacyService = require('./privacy-service.js');

module.exports = {
  DataStorage,
  JupyterParser,
  ProcedurePatterns,
  ExportService,
  PrivacyService
};
