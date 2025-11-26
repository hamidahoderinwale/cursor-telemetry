/**
 * System Routes
 * Routes for system operations: health, status, schema, core utilities, etc.
 */

const createCoreRoutes = require('../core');
const createStatusRoutes = require('../status');
const createSchemaRoutes = require('../schema');
const createMiscRoutes = require('../misc');

/**
 * Register all system-related routes
 */
function registerSystemRoutes(app, deps) {
  createCoreRoutes(deps);
  createStatusRoutes(deps);
  createSchemaRoutes(deps);
  createMiscRoutes(deps);
  
  console.log('[ROUTES] Registered system routes: core, status, schema, misc');
}

module.exports = registerSystemRoutes;






