/**
 * Web Interface Component
 * 
 * This module provides web-based dashboard and monitoring interfaces
 * for the PKL Extension system.
 */

const KuraDashboard = require('./kura-dashboard.js');
const WebServer = require('./web-server.js');
const RealMonitor = require('./real-monitor.js');

module.exports = {
  KuraDashboard,
  WebServer,
  RealMonitor
};
