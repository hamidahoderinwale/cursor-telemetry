/**
 * Screenshot API routes
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

function createScreenshotRoutes(deps) {
  const { app, screenshotMonitor } = deps;

  // API endpoint for screenshots
  app.get('/api/screenshots', (req, res) => {
    try {
      const { limit, recent, since, until } = req.query;

      let screenshots = [];

      if (recent) {
        // Get recent screenshots
        screenshots = screenshotMonitor.getRecentScreenshots(parseInt(recent) || 10);
      } else if (since && until) {
        // Get screenshots in time range
        const startTime = new Date(since).getTime();
        const endTime = new Date(until).getTime();
        screenshots = screenshotMonitor.getScreenshotsInRange(startTime, endTime);
      } else {
        // Get all screenshots
        screenshots = screenshotMonitor.getAllScreenshots();
        if (limit) {
          screenshots = screenshots.slice(0, parseInt(limit));
        }
      }

      res.json({
        success: true,
        screenshots: screenshots,
        stats: screenshotMonitor.getStats(),
      });
    } catch (error) {
      console.error('Error getting screenshots:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // API endpoint to serve images (proxy for file:// URLs)
  app.get('/api/image', async (req, res) => {
    try {
      let filePath = req.query.path;
      if (!filePath) {
        return res.status(400).json({ error: 'Missing path parameter' });
      }

      // Decode URL-encoded path (handles spaces, special characters)
      // The path might be double-encoded or have plus signs instead of spaces
      try {
        filePath = decodeURIComponent(filePath);
        // Replace + with spaces if needed (some browsers encode spaces as +)
        filePath = filePath.replace(/\+/g, ' ');
      } catch (decodeError) {
        console.warn('[IMAGE] Path decode warning:', decodeError.message);
        // If decoding fails, try using the path as-is
      }

      // Resolve the file path
      let resolvedPath = filePath;

      // Handle relative paths (e.g., "Desktop/file.png")
      if (!path.isAbsolute(filePath)) {
        // Try resolving from user's home directory
        const homeDir = os.homedir();
        resolvedPath = path.join(homeDir, filePath);
      }

      // Normalize the path (resolves . and .., handles duplicate slashes)
      resolvedPath = path.normalize(resolvedPath);

      // Security: Only allow files within user's home directory
      const homeDir = os.homedir();
      const homeDirNormalized = path.normalize(homeDir);
      if (!resolvedPath.startsWith(homeDirNormalized)) {
        console.warn('[IMAGE] Security check failed:', {
          resolvedPath,
          homeDir: homeDirNormalized,
        });
        return res.status(403).json({ error: 'Access denied: File outside home directory' });
      }

      // Check if file exists
      if (!fs.existsSync(resolvedPath)) {
        console.warn('[IMAGE] File not found:', resolvedPath);
        return res.status(404).json({ error: 'File not found', path: resolvedPath });
      }

      // Check if it's actually a file (not a directory)
      const stats = fs.statSync(resolvedPath);
      if (!stats.isFile()) {
        return res.status(400).json({ error: 'Path is not a file' });
      }

      // Check if it's an image file
      const ext = path.extname(resolvedPath).toLowerCase();
      const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp'];
      if (!imageExts.includes(ext)) {
        return res.status(400).json({ error: 'Not an image file', ext });
      }

      // Read and serve the file (use async to avoid blocking)
      const fileBuffer = await fs.promises.readFile(resolvedPath);

      const mimeTypes = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
        '.bmp': 'image/bmp',
      };

      res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
      res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
      res.setHeader('Content-Length', fileBuffer.length);

      // Send the file buffer
      res.send(fileBuffer);

      console.log(`[IMAGE] Served: ${resolvedPath} (${(fileBuffer.length / 1024).toFixed(2)}KB)`);
    } catch (error) {
      console.error('[IMAGE] Error serving image:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to serve image', details: error.message });
      }
    }
  });

  // API endpoint to get screenshots near a specific time
  app.get('/api/screenshots/near/:timestamp', (req, res) => {
    try {
      const timestamp = req.params.timestamp;
      const windowMs = parseInt(req.query.window) || 5 * 60 * 1000; // 5 minutes default

      const screenshots = screenshotMonitor.findScreenshotsNearTime(timestamp, windowMs);

      res.json({
        success: true,
        screenshots: screenshots,
        count: screenshots.length,
      });
    } catch (error) {
      console.error('Error finding screenshots:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
}

module.exports = createScreenshotRoutes;
