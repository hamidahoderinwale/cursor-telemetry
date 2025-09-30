/**
 * Content-Based Deduplication System
 * Provides intelligent content deduplication with similarity detection and optimal retrieval
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

class ContentDeduplicator extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            storageDir: options.storageDir || path.join(process.cwd(), '.deduplication'),
            enableSimilarityDetection: options.enableSimilarityDetection !== false,
            similarityThreshold: options.similarityThreshold || 0.8,
            enableSemanticHashing: options.enableSemanticHashing !== false,
            enableChunking: options.enableChunking !== false,
            chunkSize: options.chunkSize || 1024, // 1KB chunks
            maxChunks: options.maxChunks || 1000,
            enableCompression: options.enableCompression !== false,
            enableIndexing: options.enableIndexing !== false,
            ...options
        };
        
        this.contentIndex = new Map(); // Hash -> Content metadata
        this.similarityIndex = new Map(); // Similarity groups
        this.chunkIndex = new Map(); // Chunk hash -> Content references
        this.semanticIndex = new Map(); // Semantic hash -> Content references
        this.stats = {
            totalContent: 0,
            uniqueContent: 0,
            duplicatesFound: 0,
            spaceSaved: 0,
            similarityMatches: 0,
            chunkMatches: 0,
            semanticMatches: 0
        };
        
        this.setupStorage();
    }
    
    /**
     * Setup storage directory
     */
    setupStorage() {
        if (!fs.existsSync(this.options.storageDir)) {
            fs.mkdirSync(this.options.storageDir, { recursive: true });
        }
        
        // Create subdirectories
        const subdirs = ['content', 'chunks', 'semantic', 'indexes'];
        for (const subdir of subdirs) {
            const dirPath = path.join(this.options.storageDir, subdir);
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
            }
        }
    }
    
    /**
     * Generate content hash
     */
    generateContentHash(content) {
        if (typeof content === 'object') {
            content = JSON.stringify(content);
        }
        return crypto.createHash('sha256').update(content).digest('hex');
    }
    
    /**
     * Generate semantic hash for similarity detection
     */
    generateSemanticHash(content) {
        if (typeof content === 'object') {
            content = JSON.stringify(content);
        }
        
        // Normalize content for semantic hashing
        const normalized = content
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        
        // Create semantic hash based on word patterns
        const words = normalized.split(' ');
        const wordHashes = words.map(word => 
            crypto.createHash('md5').update(word).digest('hex').substring(0, 8)
        );
        
        return crypto.createHash('sha256')
            .update(wordHashes.join(''))
            .digest('hex');
    }
    
    /**
     * Generate chunk hashes for content
     */
    generateChunkHashes(content) {
        if (!this.options.enableChunking) return [];
        
        const chunks = [];
        const chunkSize = this.options.chunkSize;
        
        for (let i = 0; i < content.length; i += chunkSize) {
            const chunk = content.substring(i, i + chunkSize);
            const hash = crypto.createHash('sha256').update(chunk).digest('hex');
            chunks.push({
                index: Math.floor(i / chunkSize),
                hash: hash,
                content: chunk
            });
        }
        
        return chunks;
    }
    
    /**
     * Calculate content similarity
     */
    calculateSimilarity(content1, content2) {
        if (!this.options.enableSimilarityDetection) return 0;
        
        // Normalize content
        const norm1 = this.normalizeContent(content1);
        const norm2 = this.normalizeContent(content2);
        
        // Calculate Jaccard similarity
        const set1 = new Set(norm1.split(' '));
        const set2 = new Set(norm2.split(' '));
        
        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);
        
        return intersection.size / union.size;
    }
    
    /**
     * Normalize content for similarity comparison
     */
    normalizeContent(content) {
        return content
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
    
    /**
     * Find similar content
     */
    findSimilarContent(content, threshold = this.options.similarityThreshold) {
        const similar = [];
        const semanticHash = this.generateSemanticHash(content);
        
        // Check semantic index first
        if (this.semanticIndex.has(semanticHash)) {
            const candidates = this.semanticIndex.get(semanticHash);
            
            for (const candidateId of candidates) {
                const candidate = this.contentIndex.get(candidateId);
                if (candidate) {
                    const similarity = this.calculateSimilarity(content, candidate.content);
                    if (similarity >= threshold) {
                        similar.push({
                            id: candidateId,
                            similarity: similarity,
                            metadata: candidate.metadata
                        });
                    }
                }
            }
        }
        
        // Sort by similarity
        return similar.sort((a, b) => b.similarity - a.similarity);
    }
    
    /**
     * Find content by chunks
     */
    findContentByChunks(content) {
        const chunks = this.generateChunkHashes(content);
        const matches = new Map();
        
        for (const chunk of chunks) {
            if (this.chunkIndex.has(chunk.hash)) {
                const references = this.chunkIndex.get(chunk.hash);
                for (const ref of references) {
                    const count = matches.get(ref) || 0;
                    matches.set(ref, count + 1);
                }
            }
        }
        
        // Calculate match percentage
        const results = [];
        for (const [contentId, matchCount] of matches) {
            const content = this.contentIndex.get(contentId);
            if (content) {
                const totalChunks = Math.ceil(content.content.length / this.options.chunkSize);
                const matchPercentage = matchCount / totalChunks;
                
                if (matchPercentage >= this.options.similarityThreshold) {
                    results.push({
                        id: contentId,
                        matchPercentage: matchPercentage,
                        matchedChunks: matchCount,
                        totalChunks: totalChunks,
                        metadata: content.metadata
                    });
                }
            }
        }
        
        return results.sort((a, b) => b.matchPercentage - a.matchPercentage);
    }
    
    /**
     * Store content with deduplication
     */
    async storeContent(content, metadata = {}) {
        try {
            const contentHash = this.generateContentHash(content);
            const contentId = this.generateContentId();
            
            this.stats.totalContent++;
            
            // Check for exact duplicate
            if (this.contentIndex.has(contentHash)) {
                const existing = this.contentIndex.get(contentHash);
                this.stats.duplicatesFound++;
                this.stats.spaceSaved += Buffer.byteLength(content, 'utf8');
                
                this.emit('duplicate-found', {
                    contentId: contentId,
                    existingId: existing.id,
                    size: Buffer.byteLength(content, 'utf8')
                });
                
                return existing.id;
            }
            
            // Check for similar content
            const similar = this.findSimilarContent(content);
            if (similar.length > 0) {
                this.stats.similarityMatches++;
                
                this.emit('similar-content-found', {
                    contentId: contentId,
                    similar: similar,
                    size: Buffer.byteLength(content, 'utf8')
                });
            }
            
            // Check for chunk-based matches
            const chunkMatches = this.findContentByChunks(content);
            if (chunkMatches.length > 0) {
                this.stats.chunkMatches++;
                
                this.emit('chunk-matches-found', {
                    contentId: contentId,
                    matches: chunkMatches,
                    size: Buffer.byteLength(content, 'utf8')
                });
            }
            
            // Store content
            const contentMetadata = {
                id: contentId,
                hash: contentHash,
                content: content,
                size: Buffer.byteLength(content, 'utf8'),
                metadata: metadata,
                timestamp: Date.now(),
                chunks: this.generateChunkHashes(content),
                semanticHash: this.generateSemanticHash(content)
            };
            
            // Store in indexes
            this.contentIndex.set(contentHash, contentMetadata);
            this.stats.uniqueContent++;
            
            // Update semantic index
            if (this.options.enableSemanticHashing) {
                const semanticHash = contentMetadata.semanticHash;
                if (!this.semanticIndex.has(semanticHash)) {
                    this.semanticIndex.set(semanticHash, []);
                }
                this.semanticIndex.get(semanticHash).push(contentId);
                this.stats.semanticMatches++;
            }
            
            // Update chunk index
            if (this.options.enableChunking) {
                for (const chunk of contentMetadata.chunks) {
                    if (!this.chunkIndex.has(chunk.hash)) {
                        this.chunkIndex.set(chunk.hash, []);
                    }
                    this.chunkIndex.get(chunk.hash).push(contentId);
                }
            }
            
            // Store to disk if enabled
            if (this.options.enableIndexing) {
                await this.persistContent(contentMetadata);
            }
            
            this.emit('content-stored', {
                contentId: contentId,
                size: contentMetadata.size,
                chunks: contentMetadata.chunks.length
            });
            
            return contentId;
            
        } catch (error) {
            this.emit('storage-error', {
                content: content,
                error: error.message
            });
            throw error;
        }
    }
    
    /**
     * Retrieve content by ID
     */
    retrieveContent(contentId) {
        for (const [hash, metadata] of this.contentIndex) {
            if (metadata.id === contentId) {
                return metadata;
            }
        }
        return null;
    }
    
    /**
     * Retrieve content by hash
     */
    retrieveContentByHash(hash) {
        return this.contentIndex.get(hash) || null;
    }
    
    /**
     * Search content by query
     */
    searchContent(query, limit = 10) {
        const results = [];
        const normalizedQuery = this.normalizeContent(query);
        
        for (const [hash, metadata] of this.contentIndex) {
            const similarity = this.calculateSimilarity(query, metadata.content);
            if (similarity >= this.options.similarityThreshold) {
                results.push({
                    id: metadata.id,
                    similarity: similarity,
                    metadata: metadata.metadata,
                    content: metadata.content.substring(0, 200) + '...'
                });
            }
        }
        
        return results
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit);
    }
    
    /**
     * Generate unique content ID
     */
    generateContentId() {
        return `content_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * Persist content to disk
     */
    async persistContent(contentMetadata) {
        const filePath = path.join(
            this.options.storageDir,
            'content',
            contentMetadata.id + '.json'
        );
        
        try {
            await fs.promises.writeFile(filePath, JSON.stringify(contentMetadata, null, 2));
        } catch (error) {
            console.error('Failed to persist content:', error);
        }
    }
    
    /**
     * Load content from disk
     */
    async loadContent(contentId) {
        const filePath = path.join(
            this.options.storageDir,
            'content',
            contentId + '.json'
        );
        
        try {
            const data = await fs.promises.readFile(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            return null;
        }
    }
    
    /**
     * Build indexes from stored content
     */
    async buildIndexes() {
        const contentDir = path.join(this.options.storageDir, 'content');
        
        if (!fs.existsSync(contentDir)) return;
        
        const files = await fs.promises.readdir(contentDir);
        
        for (const file of files) {
            if (file.endsWith('.json')) {
                try {
                    const contentMetadata = await this.loadContent(file.replace('.json', ''));
                    if (contentMetadata) {
                        this.contentIndex.set(contentMetadata.hash, contentMetadata);
                        
                        // Rebuild semantic index
                        if (this.options.enableSemanticHashing) {
                            const semanticHash = contentMetadata.semanticHash;
                            if (!this.semanticIndex.has(semanticHash)) {
                                this.semanticIndex.set(semanticHash, []);
                            }
                            this.semanticIndex.get(semanticHash).push(contentMetadata.id);
                        }
                        
                        // Rebuild chunk index
                        if (this.options.enableChunking && contentMetadata.chunks) {
                            for (const chunk of contentMetadata.chunks) {
                                if (!this.chunkIndex.has(chunk.hash)) {
                                    this.chunkIndex.set(chunk.hash, []);
                                }
                                this.chunkIndex.get(chunk.hash).push(contentMetadata.id);
                            }
                        }
                    }
                } catch (error) {
                    console.error(`Failed to load content ${file}:`, error);
                }
            }
        }
        
        this.emit('indexes-built', {
            contentCount: this.contentIndex.size,
            semanticGroups: this.semanticIndex.size,
            chunkGroups: this.chunkIndex.size
        });
    }
    
    /**
     * Cleanup old content
     */
    async cleanupOldContent(maxAge = 7 * 24 * 60 * 60 * 1000) { // 7 days
        const now = Date.now();
        const toDelete = [];
        
        for (const [hash, metadata] of this.contentIndex) {
            if (now - metadata.timestamp > maxAge) {
                toDelete.push(hash);
            }
        }
        
        for (const hash of toDelete) {
            const metadata = this.contentIndex.get(hash);
            if (metadata) {
                this.contentIndex.delete(hash);
                
                // Remove from semantic index
                if (this.options.enableSemanticHashing) {
                    const semanticHash = metadata.semanticHash;
                    if (this.semanticIndex.has(semanticHash)) {
                        const refs = this.semanticIndex.get(semanticHash);
                        const index = refs.indexOf(metadata.id);
                        if (index > -1) {
                            refs.splice(index, 1);
                        }
                        if (refs.length === 0) {
                            this.semanticIndex.delete(semanticHash);
                        }
                    }
                }
                
                // Remove from chunk index
                if (this.options.enableChunking && metadata.chunks) {
                    for (const chunk of metadata.chunks) {
                        if (this.chunkIndex.has(chunk.hash)) {
                            const refs = this.chunkIndex.get(chunk.hash);
                            const index = refs.indexOf(metadata.id);
                            if (index > -1) {
                                refs.splice(index, 1);
                            }
                            if (refs.length === 0) {
                                this.chunkIndex.delete(chunk.hash);
                            }
                        }
                    }
                }
                
                // Delete from disk
                const filePath = path.join(
                    this.options.storageDir,
                    'content',
                    metadata.id + '.json'
                );
                try {
                    await fs.promises.unlink(filePath);
                } catch (error) {
                    // File might not exist
                }
            }
        }
        
        this.emit('cleanup-completed', {
            deletedCount: toDelete.length
        });
        
        return toDelete.length;
    }
    
    /**
     * Get deduplication statistics
     */
    getStats() {
        const deduplicationRatio = this.stats.totalContent > 0 
            ? (this.stats.duplicatesFound / this.stats.totalContent) * 100 
            : 0;
        
        return {
            ...this.stats,
            deduplicationRatio: deduplicationRatio.toFixed(2) + '%',
            indexes: {
                content: this.contentIndex.size,
                semantic: this.semanticIndex.size,
                chunks: this.chunkIndex.size
            },
            options: this.options
        };
    }
    
    /**
     * Destroy deduplicator
     */
    destroy() {
        this.contentIndex.clear();
        this.similarityIndex.clear();
        this.chunkIndex.clear();
        this.semanticIndex.clear();
        this.removeAllListeners();
    }
}

module.exports = ContentDeduplicator;
