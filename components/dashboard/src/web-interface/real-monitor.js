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
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    // For very large durations (months/weeks)
    if (days >= 30) {
      const months = Math.floor(days / 30);
      const remainingDays = days % 30;
      if (months >= 12) {
        const years = Math.floor(months / 12);
        const remainingMonths = months % 12;
        return remainingMonths > 0 ? `${years}y ${remainingMonths}mo` : `${years}y`;
      }
      return remainingDays > 0 ? `${months}mo ${remainingDays}d` : `${months}mo`;
    }
    
    // For large durations (weeks/days)
    if (days >= 7) {
      const weeks = Math.floor(days / 7);
      const remainingDays = days % 7;
      return remainingDays > 0 ? `${weeks}w ${remainingDays}d` : `${weeks}w`;
    }
    
    // For medium durations (days/hours)
    if (days > 0) {
      return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
    }
    
    // For small durations (hours/minutes)
    if (hours > 0) {
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
    
    // For very small durations (minutes/seconds)
    if (minutes > 0) {
      return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
    }
    
    // For tiny durations (seconds only)
    return `${secs}s`;
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
