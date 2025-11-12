/**
 * Workspace Sharing Service
 * Handles generation of shareable links and workspace data sharing
 */

const crypto = require('crypto');

class SharingService {
  constructor(persistentDB) {
    this.persistentDB = persistentDB;
    // In-memory store for shareable links (in production, use Redis or database)
    this.shareLinks = new Map();
    // Link expiration: 7 days
    this.linkExpirationMs = 7 * 24 * 60 * 60 * 1000;
  }

  /**
   * Generate unique share ID
   */
  generateShareId() {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Create a shareable link for workspace data
   * @param {Object} options - Sharing options
   * @param {string[]} options.workspaces - Workspace paths to share
   * @param {string} options.abstractionLevel - Privacy level (0-3)
   * @param {Object} options.filters - Export filters (date range, types, etc.)
   * @param {number} options.expirationDays - Link expiration in days (default: 7)
   * @returns {Object} Share link info
   */
  async createShareLink(options) {
    const {
      workspaces = [],
      abstractionLevel = 1,
      filters = {},
      expirationDays = 7,
      name = null,
    } = options;

    const shareId = this.generateShareId();
    const expiresAt =
      expirationDays === 0 ? null : Date.now() + expirationDays * 24 * 60 * 60 * 1000;

    const shareData = {
      id: shareId,
      shareId, // Alias for compatibility
      workspaces,
      abstractionLevel,
      filters,
      name,
      createdAt: Date.now(),
      expiresAt,
      accessCount: 0,
      lastAccessed: null,
    };

    // Store share link
    this.shareLinks.set(shareId, shareData);

    // Also persist to database for durability
    try {
      await this.persistentDB.saveShareLink(shareData);
    } catch (err) {
      console.warn('[SHARING] Could not persist share link:', err.message);
    }

    return {
      success: true,
      shareId,
      shareUrl: `/api/share/${shareId}`,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      qrCode: null, // Could generate QR code here
    };
  }

  /**
   * Get share link data
   * @param {string} shareId - Share link ID
   * @returns {Object|null} Share link data or null if not found/expired
   */
  async getShareLink(shareId) {
    // Check in-memory cache first
    let shareData = this.shareLinks.get(shareId);

    // If not in cache, try database
    if (!shareData) {
      try {
        shareData = await this.persistentDB.getShareLink(shareId);
        if (shareData) {
          this.shareLinks.set(shareId, shareData);
        }
      } catch (err) {
        console.warn('[SHARING] Could not load share link from DB:', err.message);
      }
    }

    if (!shareData) {
      return null;
    }

    // Check expiration (only if expiresAt is set)
    if (shareData.expiresAt && Date.now() > shareData.expiresAt) {
      this.shareLinks.delete(shareId);
      try {
        await this.persistentDB.deleteShareLink(shareId);
      } catch (err) {
        // Ignore
      }
      return null;
    }

    // Update access stats
    shareData.accessCount++;
    shareData.lastAccessed = Date.now();
    this.shareLinks.set(shareId, shareData);

    try {
      await this.persistentDB.updateShareLink(shareId, {
        accessCount: shareData.accessCount,
        lastAccessed: shareData.lastAccessed,
      });
    } catch (err) {
      // Ignore
    }

    return shareData;
  }

  /**
   * Delete a share link
   * @param {string} shareId - Share link ID
   */
  async deleteShareLink(shareId) {
    this.shareLinks.delete(shareId);
    try {
      await this.persistentDB.deleteShareLink(shareId);
    } catch (err) {
      console.warn('[SHARING] Could not delete share link from DB:', err.message);
    }
  }

  /**
   * List all share links (for management)
   * @returns {Array} List of share links
   */
  async listShareLinks() {
    try {
      const links = await this.persistentDB.getAllShareLinks();
      return links.filter((link) => Date.now() < link.expiresAt);
    } catch (err) {
      // Fallback to in-memory
      return Array.from(this.shareLinks.values()).filter((link) => Date.now() < link.expiresAt);
    }
  }

  /**
   * Clean up expired links
   */
  async cleanupExpiredLinks() {
    const now = Date.now();
    const expired = [];

    for (const [shareId, shareData] of this.shareLinks.entries()) {
      if (now > shareData.expiresAt) {
        expired.push(shareId);
      }
    }

    for (const shareId of expired) {
      this.shareLinks.delete(shareId);
      try {
        await this.persistentDB.deleteShareLink(shareId);
      } catch (err) {
        // Ignore
      }
    }

    if (expired.length > 0) {
      console.log(`[SHARING] Cleaned up ${expired.length} expired share links`);
    }
  }
}

module.exports = SharingService;
