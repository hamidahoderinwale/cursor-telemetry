/**
 * Performance Cache - Persistent caching for expensive computations
 * Stores embeddings, TF-IDF results, UMAP layouts, and similarity matrices
 * Uses IndexedDB for persistence across sessions
 */

class PerformanceCache {
  constructor() {
    this.dbName = 'PerformanceCacheDB';
    this.dbVersion = 1;
    this.db = null;
    this.initPromise = null;
  }

  /**
   * Initialize IndexedDB
   */
  async init() {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Embeddings store
        if (!db.objectStoreNames.contains('embeddings')) {
          const embeddingsStore = db.createObjectStore('embeddings', { keyPath: 'key' });
          embeddingsStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // TF-IDF store
        if (!db.objectStoreNames.contains('tfidf')) {
          const tfidfStore = db.createObjectStore('tfidf', { keyPath: 'key' });
          tfidfStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // UMAP layouts store
        if (!db.objectStoreNames.contains('umap')) {
          const umapStore = db.createObjectStore('umap', { keyPath: 'key' });
          umapStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Similarity matrices store
        if (!db.objectStoreNames.contains('similarities')) {
          const similaritiesStore = db.createObjectStore('similarities', { keyPath: 'key' });
          similaritiesStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Generate cache key from data hash
   */
  _generateKey(prefix, data) {
    // Create a simple hash from data
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `${prefix}_${Math.abs(hash)}`;
  }

  /**
   * Store embeddings
   */
  async storeEmbeddings(files, embeddings, options = {}) {
    await this.init();
    const key = this._generateKey('embeddings', files.map(f => ({ path: f.path, contentHash: f.contentHash || f.path })));
    
    const transaction = this.db.transaction(['embeddings'], 'readwrite');
    const store = transaction.objectStore('embeddings');
    
    await new Promise((resolve, reject) => {
      const request = store.put({
        key,
        files: files.map(f => ({ path: f.path, name: f.name })),
        embeddings,
        timestamp: Date.now(),
        ...options
      });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    return key;
  }

  /**
   * Get cached embeddings
   */
  async getEmbeddings(files, maxAge = 24 * 60 * 60 * 1000) {
    await this.init();
    const key = this._generateKey('embeddings', files.map(f => ({ path: f.path, contentHash: f.contentHash || f.path })));
    
    const transaction = this.db.transaction(['embeddings'], 'readonly');
    const store = transaction.objectStore('embeddings');
    
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => {
        const result = request.result;
        if (result && (Date.now() - result.timestamp) < maxAge) {
          resolve(result.embeddings);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Store TF-IDF results
   */
  async storeTFIDF(files, tfidfResults, options = {}) {
    await this.init();
    const key = this._generateKey('tfidf', files.map(f => ({ path: f.path, contentHash: f.contentHash || f.path })));
    
    const transaction = this.db.transaction(['tfidf'], 'readwrite');
    const store = transaction.objectStore('tfidf');
    
    await new Promise((resolve, reject) => {
      const request = store.put({
        key,
        files: files.map(f => ({ path: f.path, name: f.name })),
        tfidfResults,
        timestamp: Date.now(),
        ...options
      });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    return key;
  }

  /**
   * Get cached TF-IDF results
   */
  async getTFIDF(files, maxAge = 24 * 60 * 60 * 1000) {
    await this.init();
    const key = this._generateKey('tfidf', files.map(f => ({ path: f.path, contentHash: f.contentHash || f.path })));
    
    const transaction = this.db.transaction(['tfidf'], 'readonly');
    const store = transaction.objectStore('tfidf');
    
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => {
        const result = request.result;
        if (result && (Date.now() - result.timestamp) < maxAge) {
          resolve(result.tfidfResults);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Store UMAP layout
   */
  async storeUMAP(files, positions, options = {}) {
    await this.init();
    const key = this._generateKey('umap', files.map(f => ({ path: f.path, contentHash: f.contentHash || f.path })));
    
    const transaction = this.db.transaction(['umap'], 'readwrite');
    const store = transaction.objectStore('umap');
    
    await new Promise((resolve, reject) => {
      const request = store.put({
        key,
        files: files.map(f => ({ path: f.path, name: f.name })),
        positions,
        timestamp: Date.now(),
        ...options
      });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    return key;
  }

  /**
   * Get cached UMAP layout
   */
  async getUMAP(files, maxAge = 24 * 60 * 60 * 1000) {
    await this.init();
    const key = this._generateKey('umap', files.map(f => ({ path: f.path, contentHash: f.contentHash || f.path })));
    
    const transaction = this.db.transaction(['umap'], 'readonly');
    const store = transaction.objectStore('umap');
    
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => {
        const result = request.result;
        if (result && (Date.now() - result.timestamp) < maxAge) {
          resolve(result.positions);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Store similarity matrix
   */
  async storeSimilarities(files, similarities, options = {}) {
    await this.init();
    const key = this._generateKey('similarities', files.map(f => ({ path: f.path, contentHash: f.contentHash || f.path })));
    
    const transaction = this.db.transaction(['similarities'], 'readwrite');
    const store = transaction.objectStore('similarities');
    
    await new Promise((resolve, reject) => {
      const request = store.put({
        key,
        files: files.map(f => ({ path: f.path, name: f.name })),
        similarities,
        timestamp: Date.now(),
        ...options
      });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    return key;
  }

  /**
   * Get cached similarities
   */
  async getSimilarities(files, maxAge = 24 * 60 * 60 * 1000) {
    await this.init();
    const key = this._generateKey('similarities', files.map(f => ({ path: f.path, contentHash: f.contentHash || f.path })));
    
    const transaction = this.db.transaction(['similarities'], 'readonly');
    const store = transaction.objectStore('similarities');
    
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => {
        const result = request.result;
        if (result && (Date.now() - result.timestamp) < maxAge) {
          resolve(result.similarities);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear old cache entries
   */
  async clearOldEntries(maxAge = 7 * 24 * 60 * 60 * 1000) {
    await this.init();
    const cutoff = Date.now() - maxAge;
    const stores = ['embeddings', 'tfidf', 'umap', 'similarities'];

    for (const storeName of stores) {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const index = store.index('timestamp');
      
      const range = IDBKeyRange.upperBound(cutoff);
      const request = index.openCursor(range);
      
      await new Promise((resolve, reject) => {
        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          } else {
            resolve();
          }
        };
        request.onerror = () => reject(request.error);
      });
    }
  }
}

// Create singleton instance
window.performanceCache = window.performanceCache || new PerformanceCache();





