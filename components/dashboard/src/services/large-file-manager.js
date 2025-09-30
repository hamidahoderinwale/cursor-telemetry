/**
 * Large File Manager
 * Handles large files with Git LFS-like optimization, streaming, and intelligent storage
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const { createReadStream, createWriteStream } = require('fs');
const { pipeline } = require('stream/promises');

class LargeFileManager extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            largeFileThreshold: options.largeFileThreshold || 10 * 1024 * 1024, // 10MB
            storageDir: options.storageDir || path.join(process.cwd(), '.large-files'),
            enableCompression: options.enableCompression !== false,
            enableDeduplication: options.enableDeduplication !== false,
            enableStreaming: options.enableStreaming !== false,
            chunkSize: options.chunkSize || 64 * 1024, // 64KB chunks
            maxConcurrentUploads: options.maxConcurrentUploads || 5,
            enableLFS: options.enableLFS !== false,
            lfsThreshold: options.lfsThreshold || 100 * 1024, // 100KB
            ...options
        };
        
        this.storage = new Map();
        this.fileHashes = new Map();
        this.uploadQueue = [];
        this.activeUploads = new Set();
        this.stats = {
            filesProcessed: 0,
            largeFiles: 0,
            compressedFiles: 0,
            deduplicatedFiles: 0,
            streamingFiles: 0,
            totalSizeSaved: 0
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
        const subdirs = ['chunks', 'compressed', 'metadata', 'lfs'];
        for (const subdir of subdirs) {
            const dirPath = path.join(this.options.storageDir, subdir);
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
            }
        }
    }
    
    /**
     * Check if file should be handled as large file
     */
    isLargeFile(filePath) {
        try {
            const stats = fs.statSync(filePath);
            return stats.size > this.options.largeFileThreshold;
        } catch (error) {
            return false;
        }
    }
    
    /**
     * Check if file should use Git LFS
     */
    shouldUseLFS(filePath) {
        try {
            const stats = fs.statSync(filePath);
            return stats.size > this.options.lfsThreshold;
        } catch (error) {
            return false;
        }
    }
    
    /**
     * Generate file hash
     */
    async generateFileHash(filePath) {
        return new Promise((resolve, reject) => {
            const hash = crypto.createHash('sha256');
            const stream = createReadStream(filePath);
            
            stream.on('data', (data) => hash.update(data));
            stream.on('end', () => resolve(hash.digest('hex')));
            stream.on('error', reject);
        });
    }
    
    /**
     * Compress file
     */
    async compressFile(inputPath, outputPath) {
        if (!this.options.enableCompression) {
            return false;
        }
        
        try {
            const zlib = require('zlib');
            const gzip = zlib.createGzip();
            
            await pipeline(
                createReadStream(inputPath),
                gzip,
                createWriteStream(outputPath)
            );
            
            this.stats.compressedFiles++;
            return true;
        } catch (error) {
            console.error('Compression failed:', error);
            return false;
        }
    }
    
    /**
     * Decompress file
     */
    async decompressFile(inputPath, outputPath) {
        try {
            const zlib = require('zlib');
            const gunzip = zlib.createGunzip();
            
            await pipeline(
                createReadStream(inputPath),
                gunzip,
                createWriteStream(outputPath)
            );
            
            return true;
        } catch (error) {
            console.error('Decompression failed:', error);
            return false;
        }
    }
    
    /**
     * Split file into chunks
     */
    async splitFileIntoChunks(filePath, chunkSize = this.options.chunkSize) {
        const chunks = [];
        const fileHash = await this.generateFileHash(filePath);
        const stats = fs.statSync(filePath);
        const totalChunks = Math.ceil(stats.size / chunkSize);
        
        for (let i = 0; i < totalChunks; i++) {
            const chunkPath = path.join(
                this.options.storageDir,
                'chunks',
                `${fileHash}_chunk_${i}`
            );
            
            const start = i * chunkSize;
            const end = Math.min(start + chunkSize, stats.size);
            
            await this.createChunk(filePath, chunkPath, start, end - start);
            chunks.push({
                index: i,
                path: chunkPath,
                size: end - start,
                hash: fileHash
            });
        }
        
        return chunks;
    }
    
    /**
     * Create file chunk
     */
    async createChunk(inputPath, outputPath, start, length) {
        return new Promise((resolve, reject) => {
            const readStream = createReadStream(inputPath, { start, end: start + length - 1 });
            const writeStream = createWriteStream(outputPath);
            
            readStream.pipe(writeStream);
            
            writeStream.on('finish', resolve);
            writeStream.on('error', reject);
            readStream.on('error', reject);
        });
    }
    
    /**
     * Merge chunks into file
     */
    async mergeChunks(chunks, outputPath) {
        const writeStream = createWriteStream(outputPath);
        
        for (const chunk of chunks.sort((a, b) => a.index - b.index)) {
            const readStream = createReadStream(chunk.path);
            await pipeline(readStream, writeStream, { end: false });
        }
        
        writeStream.end();
    }
    
    /**
     * Store large file with optimization
     */
    async storeLargeFile(filePath, metadata = {}) {
        try {
            const stats = fs.statSync(filePath);
            const fileHash = await this.generateFileHash(filePath);
            
            // Check for deduplication
            if (this.options.enableDeduplication && this.fileHashes.has(fileHash)) {
                const existingFile = this.fileHashes.get(fileHash);
                this.stats.deduplicatedFiles++;
                this.stats.totalSizeSaved += stats.size;
                
                this.emit('file-deduplicated', {
                    originalPath: filePath,
                    existingFile: existingFile,
                    size: stats.size
                });
                
                return existingFile;
            }
            
            const fileId = this.generateFileId();
            const storagePath = path.join(this.options.storageDir, 'large-files', fileId);
            
            // Ensure directory exists
            fs.mkdirSync(path.dirname(storagePath), { recursive: true });
            
            let processedPath = filePath;
            let compressionRatio = 1;
            
            // Try compression
            if (this.options.enableCompression) {
                const compressedPath = storagePath + '.gz';
                const compressed = await this.compressFile(filePath, compressedPath);
                
                if (compressed) {
                    const compressedStats = fs.statSync(compressedPath);
                    compressionRatio = compressedStats.size / stats.size;
                    
                    if (compressionRatio < 0.9) { // Only use if significant compression
                        processedPath = compressedPath;
                        this.stats.totalSizeSaved += stats.size - compressedStats.size;
                    } else {
                        fs.unlinkSync(compressedPath);
                    }
                }
            }
            
            // Handle streaming for very large files
            if (this.options.enableStreaming && stats.size > this.options.largeFileThreshold * 2) {
                const chunks = await this.splitFileIntoChunks(processedPath);
                
                // Store chunk metadata
                const chunkMetadata = {
                    fileId: fileId,
                    originalPath: filePath,
                    originalSize: stats.size,
                    chunkCount: chunks.length,
                    chunks: chunks.map(c => ({
                        index: c.index,
                        size: c.size,
                        hash: c.hash
                    })),
                    compressionRatio: compressionRatio,
                    metadata: metadata,
                    timestamp: Date.now()
                };
                
                const metadataPath = path.join(this.options.storageDir, 'metadata', fileId + '.json');
                fs.writeFileSync(metadataPath, JSON.stringify(chunkMetadata, null, 2));
                
                this.stats.streamingFiles++;
                
                this.emit('file-stored-streaming', {
                    fileId: fileId,
                    chunks: chunks.length,
                    originalSize: stats.size
                });
                
            } else {
                // Store as single file
                fs.copyFileSync(processedPath, storagePath);
                
                const fileMetadata = {
                    fileId: fileId,
                    originalPath: filePath,
                    size: stats.size,
                    hash: fileHash,
                    compressionRatio: compressionRatio,
                    metadata: metadata,
                    timestamp: Date.now()
                };
                
                const metadataPath = path.join(this.options.storageDir, 'metadata', fileId + '.json');
                fs.writeFileSync(metadataPath, JSON.stringify(fileMetadata, null, 2));
                
                this.emit('file-stored', {
                    fileId: fileId,
                    size: stats.size,
                    compressionRatio: compressionRatio
                });
            }
            
            // Update tracking
            this.storage.set(fileId, {
                path: storagePath,
                originalPath: filePath,
                size: stats.size,
                hash: fileHash,
                timestamp: Date.now()
            });
            
            this.fileHashes.set(fileHash, fileId);
            this.stats.filesProcessed++;
            this.stats.largeFiles++;
            
            return fileId;
            
        } catch (error) {
            this.emit('storage-error', {
                filePath: filePath,
                error: error.message
            });
            throw error;
        }
    }
    
    /**
     * Retrieve large file
     */
    async retrieveLargeFile(fileId, outputPath) {
        try {
            const metadataPath = path.join(this.options.storageDir, 'metadata', fileId + '.json');
            
            if (!fs.existsSync(metadataPath)) {
                throw new Error(`File metadata not found: ${fileId}`);
            }
            
            const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
            
            if (metadata.chunks) {
                // Reconstruct from chunks
                const chunks = metadata.chunks.map(chunk => ({
                    index: chunk.index,
                    path: path.join(
                        this.options.storageDir,
                        'chunks',
                        `${metadata.hash}_chunk_${chunk.index}`
                    ),
                    size: chunk.size
                }));
                
                await this.mergeChunks(chunks, outputPath);
                
                // Decompress if needed
                if (metadata.compressionRatio < 1) {
                    const tempPath = outputPath + '.temp';
                    fs.renameSync(outputPath, tempPath);
                    await this.decompressFile(tempPath, outputPath);
                    fs.unlinkSync(tempPath);
                }
                
            } else {
                // Single file
                const storagePath = path.join(this.options.storageDir, 'large-files', fileId);
                
                if (!fs.existsSync(storagePath)) {
                    throw new Error(`File not found: ${fileId}`);
                }
                
                // Check if compressed
                if (metadata.compressionRatio < 1) {
                    await this.decompressFile(storagePath, outputPath);
                } else {
                    fs.copyFileSync(storagePath, outputPath);
                }
            }
            
            this.emit('file-retrieved', {
                fileId: fileId,
                outputPath: outputPath,
                originalSize: metadata.originalSize || metadata.size
            });
            
            return outputPath;
            
        } catch (error) {
            this.emit('retrieval-error', {
                fileId: fileId,
                error: error.message
            });
            throw error;
        }
    }
    
    /**
     * Generate unique file ID
     */
    generateFileId() {
        return `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * Get file metadata
     */
    getFileMetadata(fileId) {
        const metadataPath = path.join(this.options.storageDir, 'metadata', fileId + '.json');
        
        if (!fs.existsSync(metadataPath)) {
            return null;
        }
        
        return JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    }
    
    /**
     * List all stored files
     */
    listStoredFiles() {
        const metadataDir = path.join(this.options.storageDir, 'metadata');
        const files = [];
        
        if (fs.existsSync(metadataDir)) {
            const entries = fs.readdirSync(metadataDir);
            
            for (const entry of entries) {
                if (entry.endsWith('.json')) {
                    const fileId = entry.replace('.json', '');
                    const metadata = this.getFileMetadata(fileId);
                    if (metadata) {
                        files.push(metadata);
                    }
                }
            }
        }
        
        return files;
    }
    
    /**
     * Delete stored file
     */
    async deleteStoredFile(fileId) {
        try {
            const metadata = this.getFileMetadata(fileId);
            if (!metadata) {
                throw new Error(`File not found: ${fileId}`);
            }
            
            // Delete chunks if streaming file
            if (metadata.chunks) {
                for (const chunk of metadata.chunks) {
                    const chunkPath = path.join(
                        this.options.storageDir,
                        'chunks',
                        `${metadata.hash}_chunk_${chunk.index}`
                    );
                    if (fs.existsSync(chunkPath)) {
                        fs.unlinkSync(chunkPath);
                    }
                }
            } else {
                // Delete single file
                const storagePath = path.join(this.options.storageDir, 'large-files', fileId);
                if (fs.existsSync(storagePath)) {
                    fs.unlinkSync(storagePath);
                }
            }
            
            // Delete metadata
            const metadataPath = path.join(this.options.storageDir, 'metadata', fileId + '.json');
            if (fs.existsSync(metadataPath)) {
                fs.unlinkSync(metadataPath);
            }
            
            // Update tracking
            this.storage.delete(fileId);
            if (metadata.hash) {
                this.fileHashes.delete(metadata.hash);
            }
            
            this.emit('file-deleted', {
                fileId: fileId,
                size: metadata.originalSize || metadata.size
            });
            
        } catch (error) {
            this.emit('deletion-error', {
                fileId: fileId,
                error: error.message
            });
            throw error;
        }
    }
    
    /**
     * Cleanup orphaned files
     */
    async cleanupOrphanedFiles() {
        const metadataDir = path.join(this.options.storageDir, 'metadata');
        const chunksDir = path.join(this.options.storageDir, 'chunks');
        const largeFilesDir = path.join(this.options.storageDir, 'large-files');
        
        let cleanedCount = 0;
        
        // Clean up orphaned chunks
        if (fs.existsSync(chunksDir)) {
            const chunkFiles = fs.readdirSync(chunksDir);
            const validChunks = new Set();
            
            // Get all valid chunk references
            if (fs.existsSync(metadataDir)) {
                const metadataFiles = fs.readdirSync(metadataDir);
                for (const metadataFile of metadataFiles) {
                    if (metadataFile.endsWith('.json')) {
                        const metadata = JSON.parse(
                            fs.readFileSync(path.join(metadataDir, metadataFile), 'utf8')
                        );
                        if (metadata.chunks) {
                            for (const chunk of metadata.chunks) {
                                validChunks.add(`${metadata.hash}_chunk_${chunk.index}`);
                            }
                        }
                    }
                }
            }
            
            // Delete orphaned chunks
            for (const chunkFile of chunkFiles) {
                if (!validChunks.has(chunkFile)) {
                    fs.unlinkSync(path.join(chunksDir, chunkFile));
                    cleanedCount++;
                }
            }
        }
        
        // Clean up orphaned large files
        if (fs.existsSync(largeFilesDir)) {
            const largeFiles = fs.readdirSync(largeFilesDir);
            const validFiles = new Set();
            
            // Get all valid file references
            if (fs.existsSync(metadataDir)) {
                const metadataFiles = fs.readdirSync(metadataDir);
                for (const metadataFile of metadataFiles) {
                    if (metadataFile.endsWith('.json')) {
                        const fileId = metadataFile.replace('.json', '');
                        validFiles.add(fileId);
                    }
                }
            }
            
            // Delete orphaned files
            for (const largeFile of largeFiles) {
                if (!validFiles.has(largeFile)) {
                    fs.unlinkSync(path.join(largeFilesDir, largeFile));
                    cleanedCount++;
                }
            }
        }
        
        this.emit('cleanup-completed', {
            cleanedCount: cleanedCount
        });
        
        return cleanedCount;
    }
    
    /**
     * Get storage statistics
     */
    getStats() {
        const files = this.listStoredFiles();
        const totalSize = files.reduce((sum, file) => sum + (file.originalSize || file.size), 0);
        const compressedSize = files.reduce((sum, file) => {
            const metadata = this.getFileMetadata(file.fileId);
            return sum + (metadata ? (metadata.originalSize || metadata.size) * metadata.compressionRatio : 0);
        }, 0);
        
        return {
            ...this.stats,
            totalFiles: files.length,
            totalSize: totalSize,
            compressedSize: compressedSize,
            compressionRatio: totalSize > 0 ? compressedSize / totalSize : 1,
            spaceSaved: totalSize - compressedSize,
            options: this.options
        };
    }
    
    /**
     * Destroy large file manager
     */
    destroy() {
        this.storage.clear();
        this.fileHashes.clear();
        this.uploadQueue = [];
        this.activeUploads.clear();
        this.removeAllListeners();
    }
}

module.exports = LargeFileManager;
