#!/usr/bin/env node
/**
 * Dashboard Server - Redirects to Companion Service
 * This file exists for Render.com compatibility
 * The actual service is in components/activity-logger/companion/src/index.js
 */

// Change to companion directory and run the actual service
process.chdir(__dirname + '/components/activity-logger/companion');
require('./src/index.js');

