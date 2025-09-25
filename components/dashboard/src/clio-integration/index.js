/**
 * Clio Integration Component
 * 
 * This module provides integration with OpenClio and Kura for advanced
 * conversation analysis and procedural knowledge capture.
 */

// Python modules (require Python environment)
const DeepPKLIntegration = require('./deep_kura_openclio_integration.py');
const KuraBridge = require('./kura_bridge.py');
const NativePKLIntegration = require('./native_pkl_integration.py');
const RepositoryParser = require('./repository_parser.py');

// JavaScript modules
const KuraAPIEndpoint = require('./kura-api-endpoint.js');

module.exports = {
  DeepPKLIntegration,
  KuraBridge,
  NativePKLIntegration,
  RepositoryParser,
  KuraAPIEndpoint
};
