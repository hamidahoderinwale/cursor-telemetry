#!/usr/bin/env node

/**
 * Screenshot Monitor
 * Monitors and captures Cursor screenshots for web development
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const chokidar = require('chokidar');
const crypto = require('crypto');

class ScreenshotMonitor {
  constructor() {
    this.screenshotPaths = this.findScreenshotPaths();
    this.watchers = [];
    this.screenshots = new Map(); // Store screenshot metadata
    this.onScreenshotCallback = null;
  }

  /**
   * Find all Cursor screenshot directories
   */
  findScreenshotPaths() {
    const basePath = path.join(os.homedir(), 'Library/Application Support/Cursor');
    
    return {
      workspaceImages: path.join(basePath, 'User/workspaceStorage/images'),
      history: path.join(basePath, 'User/History')
    };
  }

  /**
   * Start monitoring for screenshots
   */
  start(callback) {
    console.log('📷 Starting screenshot monitor...');
    this.onScreenshotCallback = callback;

    // Monitor workspace images directory
    if (fs.existsSync(this.screenshotPaths.workspaceImages)) {
      const workspaceWatcher = chokidar.watch(this.screenshotPaths.workspaceImages, {
        persistent: true,
        ignoreInitial: false, // Process existing screenshots
        awaitWriteFinish: {
          stabilityThreshold: 1000,
          pollInterval: 100
        }
      });

      workspaceWatcher
        .on('add', (filePath) => this.handleScreenshotAdded(filePath, 'workspace'))
        .on('change', (filePath) => this.handleScreenshotChanged(filePath, 'workspace'))
        .on('unlink', (filePath) => this.handleScreenshotDeleted(filePath));

      this.watchers.push(workspaceWatcher);
      console.log(`📷 Monitoring workspace screenshots: ${this.screenshotPaths.workspaceImages}`);
    }

    // Monitor history directory (for historical screenshots)
    if (fs.existsSync(this.screenshotPaths.history)) {
      const historyWatcher = chokidar.watch(this.screenshotPaths.history, {
        persistent: true,
        ignoreInitial: false,
        depth: 2, // Scan subdirectories
        awaitWriteFinish: {
          stabilityThreshold: 1000,
          pollInterval: 100
        }
      });

      historyWatcher
        .on('add', (filePath) => {
          if (this.isImageFile(filePath)) {
            this.handleScreenshotAdded(filePath, 'history');
          }
        })
        .on('change', (filePath) => {
          if (this.isImageFile(filePath)) {
            this.handleScreenshotChanged(filePath, 'history');
          }
        })
        .on('unlink', (filePath) => {
          if (this.isImageFile(filePath)) {
            this.handleScreenshotDeleted(filePath);
          }
        });

      this.watchers.push(historyWatcher);
      console.log(`📷 Monitoring history screenshots: ${this.screenshotPaths.history}`);
    }

    console.log('✅ Screenshot monitor started');
  }

  /**
   * Check if file is an image
   */
  isImageFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return ['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext);
  }

  /**
   * Handle new screenshot
   */
  async handleScreenshotAdded(filePath, source) {
    try {
      if (!this.isImageFile(filePath)) return;

      const stats = fs.statSync(filePath);
      const fileName = path.basename(filePath);
      
      // Extract metadata from filename
      const metadata = this.extractScreenshotMetadata(fileName);
      
      // Generate unique ID
      const screenshotId = crypto.randomUUID();
      
      const screenshotData = {
        id: screenshotId,
        path: filePath,
        fileName: fileName,
        source: source,
        timestamp: stats.birthtime || stats.mtime,
        size: stats.size,
        ...metadata
      };

      // Store screenshot data
      this.screenshots.set(screenshotId, screenshotData);

      console.log(`📷 New screenshot captured: ${fileName} (${source})`);

      // Call callback if provided
      if (this.onScreenshotCallback) {
        this.onScreenshotCallback('added', screenshotData);
      }

      return screenshotData;
    } catch (error) {
      console.warn(`Error processing screenshot ${filePath}:`, error.message);
    }
  }

  /**
   * Handle screenshot change
   */
  async handleScreenshotChanged(filePath, source) {
    try {
      const existingScreenshot = Array.from(this.screenshots.values())
        .find(s => s.path === filePath);

      if (existingScreenshot) {
        const stats = fs.statSync(filePath);
        existingScreenshot.timestamp = stats.mtime;
        existingScreenshot.size = stats.size;

        console.log(`📷 Screenshot updated: ${path.basename(filePath)}`);

        if (this.onScreenshotCallback) {
          this.onScreenshotCallback('changed', existingScreenshot);
        }
      } else {
        // New screenshot, treat as added
        await this.handleScreenshotAdded(filePath, source);
      }
    } catch (error) {
      console.warn(`Error updating screenshot ${filePath}:`, error.message);
    }
  }

  /**
   * Handle screenshot deletion
   */
  handleScreenshotDeleted(filePath) {
    const existingScreenshot = Array.from(this.screenshots.entries())
      .find(([id, s]) => s.path === filePath);

    if (existingScreenshot) {
      const [id, data] = existingScreenshot;
      this.screenshots.delete(id);

      console.log(`📷 Screenshot deleted: ${path.basename(filePath)}`);

      if (this.onScreenshotCallback) {
        this.onScreenshotCallback('deleted', data);
      }
    }
  }

  /**
   * Extract metadata from screenshot filename
   * Format: "Screenshot YYYY-MM-DD at H.MM.SS XM-UUID.png"
   */
  extractScreenshotMetadata(fileName) {
    const metadata = {
      isScreenshot: false,
      captureDate: null,
      uuid: null,
      description: null
    };

    // Check if it's a Cursor screenshot
    if (fileName.startsWith('Screenshot ')) {
      metadata.isScreenshot = true;

      // Try to extract date
      const dateMatch = fileName.match(/Screenshot (\d{4}-\d{2}-\d{2} at \d{1,2}\.\d{2}\.\d{2} [AP]M)/);
      if (dateMatch) {
        metadata.description = dateMatch[1];
        
        // Parse date
        try {
          const dateStr = dateMatch[1].replace(/ at /, ' ').replace(/\./g, ':');
          metadata.captureDate = new Date(dateStr);
        } catch (e) {
          // Couldn't parse date
        }
      }

      // Extract UUID
      const uuidMatch = fileName.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
      if (uuidMatch) {
        metadata.uuid = uuidMatch[1];
      }
    }

    return metadata;
  }

  /**
   * Get all screenshots
   */
  getAllScreenshots() {
    return Array.from(this.screenshots.values());
  }

  /**
   * Get recent screenshots
   */
  getRecentScreenshots(count = 10) {
    return Array.from(this.screenshots.values())
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, count);
  }

  /**
   * Get screenshots in time range
   */
  getScreenshotsInRange(startTime, endTime) {
    return Array.from(this.screenshots.values())
      .filter(s => {
        const time = new Date(s.timestamp).getTime();
        return time >= startTime && time <= endTime;
      })
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  /**
   * Link screenshot to prompt/event
   */
  linkScreenshotToEvent(screenshotId, eventId, eventType = 'prompt') {
    const screenshot = this.screenshots.get(screenshotId);
    if (screenshot) {
      if (!screenshot.linkedEvents) {
        screenshot.linkedEvents = [];
      }
      screenshot.linkedEvents.push({
        eventId: eventId,
        eventType: eventType,
        linkedAt: Date.now()
      });
      return true;
    }
    return false;
  }

  /**
   * Find screenshots near a timestamp (within 5 minutes)
   */
  findScreenshotsNearTime(timestamp, windowMs = 5 * 60 * 1000) {
    const targetTime = new Date(timestamp).getTime();
    return Array.from(this.screenshots.values())
      .filter(s => {
        const screenshotTime = new Date(s.timestamp).getTime();
        return Math.abs(screenshotTime - targetTime) <= windowMs;
      })
      .sort((a, b) => {
        const aDiff = Math.abs(new Date(a.timestamp).getTime() - targetTime);
        const bDiff = Math.abs(new Date(b.timestamp).getTime() - targetTime);
        return aDiff - bDiff;
      });
  }

  /**
   * Get statistics
   */
  getStats() {
    const screenshots = this.getAllScreenshots();
    return {
      total: screenshots.length,
      workspace: screenshots.filter(s => s.source === 'workspace').length,
      history: screenshots.filter(s => s.source === 'history').length,
      recent: this.getRecentScreenshots(5).length,
      oldest: screenshots.length > 0 ? 
        screenshots.reduce((oldest, s) => 
          new Date(s.timestamp) < new Date(oldest.timestamp) ? s : oldest
        ).timestamp : null,
      newest: screenshots.length > 0 ? 
        screenshots.reduce((newest, s) => 
          new Date(s.timestamp) > new Date(newest.timestamp) ? s : newest
        ).timestamp : null
    };
  }

  /**
   * Stop monitoring
   */
  stop() {
    console.log('📷 Stopping screenshot monitor...');
    this.watchers.forEach(watcher => watcher.close());
    this.watchers = [];
    console.log('✅ Screenshot monitor stopped');
  }
}

module.exports = ScreenshotMonitor;

