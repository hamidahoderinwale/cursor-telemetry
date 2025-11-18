/**
 * Data Routes
 * Routes for accessing core data: events, entries, prompts, workspaces, etc.
 */

const createActivityRoutes = require('../activity');
const createDatabaseRoutes = require('../database');
const createRawDataRoutes = require('../raw-data');
const createFileContentsRoutes = require('../file-contents');
const createPromptRoutes = require('../prompts');
const createWorkspaceRoutes = require('../workspace');

/**
 * Register all data-related routes
 */
function registerDataRoutes(app, deps) {
  createActivityRoutes(deps);
  createDatabaseRoutes(deps);
  createRawDataRoutes(deps);
  createFileContentsRoutes(deps);
  createPromptRoutes(deps);
  createWorkspaceRoutes(deps);
  
  console.log('[ROUTES] Registered data routes: activity, database, raw-data, file-contents, prompts, workspace');
}

module.exports = registerDataRoutes;




