/**
 * Real Monitor - Simplified implementation for web server
 * Provides basic session monitoring functionality
 */

class RealMonitor {
  constructor() {
    this.activeSessions = [];
    this.isMonitoring = false;
    this.dataStorage = null;
    this.broadcastCallback = null;
    this.eventQueue = null;
  }

  startMonitoring() {
    console.log('Real Monitor: Starting monitoring...');
    this.isMonitoring = true;
  }

  stopMonitoring() {
    console.log('Real Monitor: Stopping monitoring...');
    this.isMonitoring = false;
  }

  getActiveSessions() {
    return this.activeSessions;
  }

  getSession(sessionId) {
    return this.activeSessions.find(session => session.id === sessionId);
  }

  getLiveDuration(sessionId) {
    const session = this.getSession(sessionId);
    if (!session) return 0;
    
    const startTime = new Date(session.timestamp);
    const now = new Date();
    return now - startTime;
  }

  formatDuration(duration) {
    if (!duration) return '0s';
    
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  setBroadcastCallback(callback) {
    this.broadcastCallback = callback;
  }

  setEventQueue(eventQueue) {
    this.eventQueue = eventQueue;
  }

  // Add a session to active sessions
  addSession(session) {
    const existingIndex = this.activeSessions.findIndex(s => s.id === session.id);
    if (existingIndex >= 0) {
      this.activeSessions[existingIndex] = session;
    } else {
      this.activeSessions.push(session);
    }
    
    if (this.broadcastCallback) {
      this.broadcastCallback('sessions-update', this.activeSessions);
    }
  }

  // Remove a session from active sessions
  removeSession(sessionId) {
    this.activeSessions = this.activeSessions.filter(s => s.id !== sessionId);
    
    if (this.broadcastCallback) {
      this.broadcastCallback('sessions-update', this.activeSessions);
    }
  }
}

module.exports = RealMonitor;
