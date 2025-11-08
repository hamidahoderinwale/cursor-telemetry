/**
 * LocalStorage Helper Utility
 * Provides safe, consistent localStorage operations with error handling
 * Reduces code duplication across multiple modules
 */

class LocalStorageHelper {
  /**
   * Safely get an item from localStorage
   * @param {string} key - Storage key
   * @param {*} defaultValue - Default value if key doesn't exist or parse fails
   * @param {boolean} parseJson - Whether to parse JSON (default: true). Set to false for string values.
   * @returns {*} Parsed value or default
   */
  static get(key, defaultValue = null, parseJson = true) {
    try {
      const item = localStorage.getItem(key);
      if (item === null) return defaultValue;
      if (!parseJson) return item; // Return raw string
      return JSON.parse(item);
    } catch (e) {
      console.warn(`[STORAGE] Failed to get ${key}:`, e.message);
      return defaultValue;
    }
  }

  /**
   * Safely set an item in localStorage
   * @param {string} key - Storage key
   * @param {*} value - Value to store (will be JSON stringified unless stringify is false)
   * @param {boolean} stringify - Whether to JSON stringify (default: true). Set to false for string values.
   * @returns {boolean} Success status
   */
  static set(key, value, stringify = true) {
    try {
      const item = stringify ? JSON.stringify(value) : String(value);
      localStorage.setItem(key, item);
      return true;
    } catch (e) {
      // Handle quota exceeded or other errors
      if (e.name === 'QuotaExceededError') {
        console.warn(`[STORAGE] Quota exceeded for ${key}, attempting cleanup...`);
        // Could implement cleanup logic here
      } else {
        console.warn(`[STORAGE] Failed to set ${key}:`, e.message);
      }
      return false;
    }
  }

  /**
   * Remove an item from localStorage
   * @param {string} key - Storage key
   */
  static remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn(`[STORAGE] Failed to remove ${key}:`, e.message);
    }
  }

  /**
   * Check if a key exists in localStorage
   * @param {string} key - Storage key
   * @returns {boolean} Whether key exists
   */
  static has(key) {
    try {
      return localStorage.getItem(key) !== null;
    } catch (e) {
      return false;
    }
  }

  /**
   * Clear all localStorage items (use with caution)
   */
  static clear() {
    try {
      localStorage.clear();
    } catch (e) {
      console.warn('[STORAGE] Failed to clear localStorage:', e.message);
    }
  }

  /**
   * Get storage usage estimate (approximate)
   * @returns {Object} Usage info
   */
  static getUsage() {
    try {
      let total = 0;
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          total += localStorage[key].length + key.length;
        }
      }
      return {
        approximateSize: total,
        approximateSizeKB: (total / 1024).toFixed(2),
        itemCount: Object.keys(localStorage).length
      };
    } catch (e) {
      return { approximateSize: 0, approximateSizeKB: '0', itemCount: 0 };
    }
  }
}

// Export for use in modules
window.LocalStorageHelper = LocalStorageHelper;

