/**
 * Session and workspace management service
 */

const fs = require('fs');
const path = require('path');

class SessionManager {
  constructor() {
    this.activeSession = 'session-' + Date.now();
    this.lastActivityTime = Date.now();
    this.SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds
    this.currentWorkspace = process.cwd(); // Default workspace
    this.workspaceSessions = new Map(); // Map of workspace paths to active sessions
    this.workspaceData = new Map(); // Map of workspace paths to their data
    this.knownWorkspaces = new Set(); // Track all discovered workspaces
  }

  createNewSession() {
    this.activeSession = 'session-' + Date.now();
    this.lastActivityTime = Date.now();
    console.log(`[SYNC] Created new session: ${this.activeSession}`);
    return this.activeSession;
  }

  checkSessionTimeout() {
    const now = Date.now();
    const timeSinceLastActivity = now - this.lastActivityTime;

    if (timeSinceLastActivity > this.SESSION_TIMEOUT) {
      console.log(
        `[TIME] Session timeout reached (${Math.round(timeSinceLastActivity / 60000)} minutes), creating new session`
      );
      this.createNewSession();
    }
  }

  updateActivityTime() {
    this.lastActivityTime = Date.now();
  }

  detectWorkspace(filePath) {
    if (!filePath) return this.currentWorkspace;

    let searchPath = path.isAbsolute(filePath) ? path.dirname(filePath) : path.resolve(filePath);

    // First pass: look for .git directory (highest priority - marks the true project root)
    let currentSearch = searchPath;
    let gitRoot = null;
    const maxDepth = 15;
    let depth = 0;

    while (currentSearch !== path.dirname(currentSearch) && depth < maxDepth) {
      const gitPath = path.join(currentSearch, '.git');
      if (fs.existsSync(gitPath)) {
        gitRoot = currentSearch;
        // Don't break - keep searching up to find the topmost .git
      }
      currentSearch = path.dirname(currentSearch);
      depth++;
    }

    // If we found a git root, that's the workspace
    if (gitRoot) {
      this.knownWorkspaces.add(gitRoot);
      return gitRoot;
    }

    // Second pass: if no .git found, look for other strong workspace indicators
    // but only at reasonably high levels (not deep nested directories)
    currentSearch = searchPath;
    depth = 0;
    const strongIndicators = ['.cursor', 'Cargo.toml', 'go.mod', 'requirements.txt', 'pom.xml'];

    while (currentSearch !== path.dirname(currentSearch) && depth < maxDepth) {
      // Check for strong indicators
      for (const indicator of strongIndicators) {
        const indicatorPath = path.join(currentSearch, indicator);
        if (fs.existsSync(indicatorPath)) {
          // Only accept if it's at a reasonable level (not too deep)
          const parts = currentSearch.split(path.sep);
          if (parts.length <= 7) {
            // Adjust based on typical depth
            this.knownWorkspaces.add(currentSearch);
            return currentSearch;
          }
        }
      }
      currentSearch = path.dirname(currentSearch);
      depth++;
    }

    // Third pass: look for well-known parent directories
    const parts = searchPath.split(path.sep);
    for (let i = parts.length - 1; i >= 3; i--) {
      const dirName = parts[i];
      if (
        ['Desktop', 'Documents', 'Projects', 'Code', 'dev', 'workspace', 'repos'].includes(dirName)
      ) {
        // Take the directory right under this
        if (i + 1 < parts.length) {
          const workspacePath = parts.slice(0, i + 2).join(path.sep);
          this.knownWorkspaces.add(workspacePath);
          return workspacePath;
        }
      }
    }

    // Last resort: use a reasonable parent (3-4 levels deep from root)
    if (parts.length > 4) {
      const workspacePath = parts.slice(0, 5).join(path.sep);
      this.knownWorkspaces.add(workspacePath);
      return workspacePath;
    }

    this.knownWorkspaces.add(searchPath);
    return searchPath;
  }

  getWorkspaceSession(workspacePath) {
    if (!this.workspaceSessions.has(workspacePath)) {
      this.workspaceSessions.set(workspacePath, 'session-' + Date.now());
    }
    return this.workspaceSessions.get(workspacePath);
  }

  updateWorkspaceData(workspacePath, entry, event) {
    if (!this.workspaceData.has(workspacePath)) {
      this.workspaceData.set(workspacePath, {
        entries: [],
        events: [],
        lastActivity: Date.now(),
      });
    }

    const data = this.workspaceData.get(workspacePath);
    if (entry) data.entries.push(entry);
    if (event) data.events.push(event);
    data.lastActivity = Date.now();
  }

  getWorkspaceData(workspacePath) {
    return this.workspaceData.get(workspacePath);
  }

  getAllWorkspaces() {
    return Array.from(this.knownWorkspaces);
  }
}

module.exports = SessionManager;
