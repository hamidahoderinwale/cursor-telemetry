/**
 * Session State Persistence Service
 * Handles comprehensive session state persistence and recovery
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class SessionStatePersistence {
    constructor(options = {}) {
        this.dataDir = options.dataDir || path.join(process.env.HOME || '', '.pkl', 'session-state');
        this.maxHistorySize = options.maxHistorySize || 1000;
        this.compressionEnabled = options.compressionEnabled || true;
        this.encryptionEnabled = options.encryptionEnabled || false;
        this.encryptionKey = options.encryptionKey || null;
        
        this.stateCache = new Map();
        this.pendingWrites = new Map();
        this.writeQueue = [];
        this.isProcessingQueue = false;
        
        this.initializeStorage();
    }

    /**
     * Initialize storage directory and structures
     */
    async initializeStorage() {
        try {
            await fs.mkdir(this.dataDir, { recursive: true });
            await fs.mkdir(path.join(this.dataDir, 'sessions'), { recursive: true });
            await fs.mkdir(path.join(this.dataDir, 'checkpoints'), { recursive: true });
            await fs.mkdir(path.join(this.dataDir, 'snapshots'), { recursive: true });
            
            console.log('Session state persistence initialized');
        } catch (error) {
            console.error('Failed to initialize session state persistence:', error);
            throw error;
        }
    }

    /**
     * Save comprehensive session state
     */
    async saveSessionState(sessionId, state, options = {}) {
        const {
            createCheckpoint = true,
            createSnapshot = false,
            priority = 'normal',
            metadata = {}
        } = options;

        const stateData = {
            sessionId,
            timestamp: new Date().toISOString(),
            state: this.sanitizeState(state),
            metadata: {
                ...metadata,
                version: '2.0',
                checksum: this.calculateChecksum(state)
            }
        };

        try {
            // Add to write queue for batch processing
            this.writeQueue.push({
                type: 'save',
                sessionId,
                data: stateData,
                priority,
                createCheckpoint,
                createSnapshot
            });

            // Process queue if not already processing
            if (!this.isProcessingQueue) {
                await this.processWriteQueue();
            }

            // Update cache
            this.stateCache.set(sessionId, stateData);

            return {
                success: true,
                sessionId,
                timestamp: stateData.timestamp,
                checksum: stateData.metadata.checksum
            };
        } catch (error) {
            console.error('Failed to save session state:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Load session state with recovery options
     */
    async loadSessionState(sessionId, options = {}) {
        const {
            useCache = true,
            fallbackToCheckpoint = true,
            fallbackToSnapshot = false,
            validateChecksum = true
        } = options;

        try {
            // Try cache first
            if (useCache && this.stateCache.has(sessionId)) {
                const cachedState = this.stateCache.get(sessionId);
                if (validateChecksum && !this.validateChecksum(cachedState)) {
                    console.warn(`Checksum validation failed for cached state: ${sessionId}`);
                } else {
                    return {
                        success: true,
                        sessionId,
                        state: cachedState.state,
                        source: 'cache',
                        timestamp: cachedState.timestamp
                    };
                }
            }

            // Try to load from disk
            const stateData = await this.loadFromDisk(sessionId);
            if (stateData) {
                if (validateChecksum && !this.validateChecksum(stateData)) {
                    console.warn(`Checksum validation failed for disk state: ${sessionId}`);
                    if (fallbackToCheckpoint) {
                        return await this.loadFromCheckpoint(sessionId, options);
                    }
                } else {
                    // Update cache
                    this.stateCache.set(sessionId, stateData);
                    return {
                        success: true,
                        sessionId,
                        state: stateData.state,
                        source: 'disk',
                        timestamp: stateData.timestamp
                    };
                }
            }

            // Try checkpoint if enabled
            if (fallbackToCheckpoint) {
                const checkpointResult = await this.loadFromCheckpoint(sessionId, options);
                if (checkpointResult.success) {
                    return checkpointResult;
                }
            }

            // Try snapshot if enabled
            if (fallbackToSnapshot) {
                const snapshotResult = await this.loadFromSnapshot(sessionId, options);
                if (snapshotResult.success) {
                    return snapshotResult;
                }
            }

            return {
                success: false,
                error: 'No valid session state found'
            };

        } catch (error) {
            console.error('Failed to load session state:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Create a checkpoint of current session state
     */
    async createCheckpoint(sessionId, metadata = {}) {
        try {
            const stateData = this.stateCache.get(sessionId);
            if (!stateData) {
                throw new Error('No session state in cache to checkpoint');
            }

            const checkpointData = {
                ...stateData,
                checkpointTimestamp: new Date().toISOString(),
                checkpointMetadata: metadata
            };

            const checkpointPath = path.join(
                this.dataDir, 
                'checkpoints', 
                `${sessionId}_${Date.now()}.json`
            );

            await this.writeToFile(checkpointPath, checkpointData);

            // Clean up old checkpoints
            await this.cleanupOldCheckpoints(sessionId);

            return {
                success: true,
                checkpointPath,
                timestamp: checkpointData.checkpointTimestamp
            };
        } catch (error) {
            console.error('Failed to create checkpoint:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Create a snapshot of session state
     */
    async createSnapshot(sessionId, metadata = {}) {
        try {
            const stateData = this.stateCache.get(sessionId);
            if (!stateData) {
                throw new Error('No session state in cache to snapshot');
            }

            const snapshotData = {
                ...stateData,
                snapshotTimestamp: new Date().toISOString(),
                snapshotMetadata: metadata,
                isSnapshot: true
            };

            const snapshotPath = path.join(
                this.dataDir, 
                'snapshots', 
                `${sessionId}_${Date.now()}.json`
            );

            await this.writeToFile(snapshotPath, snapshotData);

            return {
                success: true,
                snapshotPath,
                timestamp: snapshotData.snapshotTimestamp
            };
        } catch (error) {
            console.error('Failed to create snapshot:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Restore session state from a specific point
     */
    async restoreSessionState(sessionId, restorePoint, options = {}) {
        const {
            createBackup = true,
            validateState = true
        } = options;

        try {
            let stateData = null;

            // Determine restore point type
            if (restorePoint.type === 'checkpoint') {
                const result = await this.loadFromCheckpoint(sessionId, { checkpointId: restorePoint.id });
                if (result.success) {
                    stateData = result.stateData;
                }
            } else if (restorePoint.type === 'snapshot') {
                const result = await this.loadFromSnapshot(sessionId, { snapshotId: restorePoint.id });
                if (result.success) {
                    stateData = result.stateData;
                }
            } else if (restorePoint.type === 'timestamp') {
                stateData = await this.loadFromTimestamp(sessionId, restorePoint.timestamp);
            }

            if (!stateData) {
                throw new Error('Could not load state from restore point');
            }

            // Create backup if requested
            if (createBackup) {
                await this.createBackup(sessionId);
            }

            // Validate state if requested
            if (validateState && !this.validateStateIntegrity(stateData)) {
                throw new Error('State validation failed');
            }

            // Restore the state
            this.stateCache.set(sessionId, stateData);
            await this.saveToDisk(sessionId, stateData);

            return {
                success: true,
                sessionId,
                restoredFrom: restorePoint,
                timestamp: stateData.timestamp
            };
        } catch (error) {
            console.error('Failed to restore session state:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get session state history
     */
    async getSessionStateHistory(sessionId, options = {}) {
        const {
            limit = 50,
            includeCheckpoints = true,
            includeSnapshots = true
        } = options;

        try {
            const history = [];

            // Get regular state files
            const sessionDir = path.join(this.dataDir, 'sessions');
            const files = await fs.readdir(sessionDir);
            const sessionFiles = files.filter(file => file.startsWith(sessionId));

            for (const file of sessionFiles) {
                const filePath = path.join(sessionDir, file);
                const stat = await fs.stat(filePath);
                const data = await this.readFromFile(filePath);
                
                history.push({
                    type: 'state',
                    timestamp: data.timestamp,
                    file: file,
                    size: stat.size
                });
            }

            // Get checkpoints if requested
            if (includeCheckpoints) {
                const checkpointDir = path.join(this.dataDir, 'checkpoints');
                const checkpointFiles = await fs.readdir(checkpointDir);
                const sessionCheckpoints = checkpointFiles.filter(file => file.startsWith(sessionId));

                for (const file of sessionCheckpoints) {
                    const filePath = path.join(checkpointDir, file);
                    const stat = await fs.stat(filePath);
                    const data = await this.readFromFile(filePath);
                    
                    history.push({
                        type: 'checkpoint',
                        timestamp: data.checkpointTimestamp,
                        file: file,
                        size: stat.size
                    });
                }
            }

            // Get snapshots if requested
            if (includeSnapshots) {
                const snapshotDir = path.join(this.dataDir, 'snapshots');
                const snapshotFiles = await fs.readdir(snapshotDir);
                const sessionSnapshots = snapshotFiles.filter(file => file.startsWith(sessionId));

                for (const file of sessionSnapshots) {
                    const filePath = path.join(snapshotDir, file);
                    const stat = await fs.stat(filePath);
                    const data = await this.readFromFile(filePath);
                    
                    history.push({
                        type: 'snapshot',
                        timestamp: data.snapshotTimestamp,
                        file: file,
                        size: stat.size
                    });
                }
            }

            // Sort by timestamp and limit
            history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            return history.slice(0, limit);

        } catch (error) {
            console.error('Failed to get session state history:', error);
            return [];
        }
    }

    /**
     * Clean up old session data
     */
    async cleanupSessionData(sessionId, options = {}) {
        const {
            keepCheckpoints = 5,
            keepSnapshots = 3,
            keepStates = 10
        } = options;

        try {
            // Clean up old states
            const sessionDir = path.join(this.dataDir, 'sessions');
            const files = await fs.readdir(sessionDir);
            const sessionFiles = files.filter(file => file.startsWith(sessionId));
            
            if (sessionFiles.length > keepStates) {
                sessionFiles.sort().slice(0, sessionFiles.length - keepStates).forEach(async (file) => {
                    await fs.unlink(path.join(sessionDir, file));
                });
            }

            // Clean up old checkpoints
            await this.cleanupOldCheckpoints(sessionId, keepCheckpoints);

            // Clean up old snapshots
            await this.cleanupOldSnapshots(sessionId, keepSnapshots);

            return { success: true };
        } catch (error) {
            console.error('Failed to cleanup session data:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Process write queue for batch operations
     */
    async processWriteQueue() {
        if (this.isProcessingQueue) return;
        
        this.isProcessingQueue = true;
        
        try {
            // Sort by priority
            this.writeQueue.sort((a, b) => {
                const priorityOrder = { high: 3, normal: 2, low: 1 };
                return priorityOrder[b.priority] - priorityOrder[a.priority];
            });

            while (this.writeQueue.length > 0) {
                const operation = this.writeQueue.shift();
                await this.executeWriteOperation(operation);
            }
        } finally {
            this.isProcessingQueue = false;
        }
    }

    /**
     * Execute individual write operation
     */
    async executeWriteOperation(operation) {
        try {
            switch (operation.type) {
                case 'save':
                    await this.saveToDisk(operation.sessionId, operation.data);
                    if (operation.createCheckpoint) {
                        await this.createCheckpoint(operation.sessionId);
                    }
                    if (operation.createSnapshot) {
                        await this.createSnapshot(operation.sessionId);
                    }
                    break;
                default:
                    console.warn('Unknown write operation type:', operation.type);
            }
        } catch (error) {
            console.error('Failed to execute write operation:', error);
        }
    }

    /**
     * Helper methods
     */
    async loadFromDisk(sessionId) {
        const sessionPath = path.join(this.dataDir, 'sessions', `${sessionId}.json`);
        return await this.readFromFile(sessionPath);
    }

    async saveToDisk(sessionId, stateData) {
        const sessionPath = path.join(this.dataDir, 'sessions', `${sessionId}.json`);
        await this.writeToFile(sessionPath, stateData);
    }

    async loadFromCheckpoint(sessionId, options = {}) {
        const checkpointDir = path.join(this.dataDir, 'checkpoints');
        const files = await fs.readdir(checkpointDir);
        const sessionCheckpoints = files.filter(file => file.startsWith(sessionId));
        
        if (sessionCheckpoints.length === 0) {
            return { success: false, error: 'No checkpoints found' };
        }

        // Get the most recent checkpoint
        sessionCheckpoints.sort();
        const latestCheckpoint = sessionCheckpoints[sessionCheckpoints.length - 1];
        const checkpointPath = path.join(checkpointDir, latestCheckpoint);
        
        const stateData = await this.readFromFile(checkpointPath);
        return {
            success: true,
            stateData,
            source: 'checkpoint',
            checkpointFile: latestCheckpoint
        };
    }

    async loadFromSnapshot(sessionId, options = {}) {
        const snapshotDir = path.join(this.dataDir, 'snapshots');
        const files = await fs.readdir(snapshotDir);
        const sessionSnapshots = files.filter(file => file.startsWith(sessionId));
        
        if (sessionSnapshots.length === 0) {
            return { success: false, error: 'No snapshots found' };
        }

        // Get the most recent snapshot
        sessionSnapshots.sort();
        const latestSnapshot = sessionSnapshots[sessionSnapshots.length - 1];
        const snapshotPath = path.join(snapshotDir, latestSnapshot);
        
        const stateData = await this.readFromFile(snapshotPath);
        return {
            success: true,
            stateData,
            source: 'snapshot',
            snapshotFile: latestSnapshot
        };
    }

    async loadFromTimestamp(sessionId, timestamp) {
        // Implementation would find the closest state to the given timestamp
        // This is a simplified version
        return await this.loadFromDisk(sessionId);
    }

    async createBackup(sessionId) {
        const currentState = this.stateCache.get(sessionId);
        if (currentState) {
            const backupPath = path.join(
                this.dataDir, 
                'backups', 
                `${sessionId}_backup_${Date.now()}.json`
            );
            await fs.mkdir(path.dirname(backupPath), { recursive: true });
            await this.writeToFile(backupPath, currentState);
        }
    }

    async cleanupOldCheckpoints(sessionId, keepCount = 5) {
        const checkpointDir = path.join(this.dataDir, 'checkpoints');
        const files = await fs.readdir(checkpointDir);
        const sessionCheckpoints = files.filter(file => file.startsWith(sessionId));
        
        if (sessionCheckpoints.length > keepCount) {
            sessionCheckpoints.sort();
            const toDelete = sessionCheckpoints.slice(0, sessionCheckpoints.length - keepCount);
            
            for (const file of toDelete) {
                await fs.unlink(path.join(checkpointDir, file));
            }
        }
    }

    async cleanupOldSnapshots(sessionId, keepCount = 3) {
        const snapshotDir = path.join(this.dataDir, 'snapshots');
        const files = await fs.readdir(snapshotDir);
        const sessionSnapshots = files.filter(file => file.startsWith(sessionId));
        
        if (sessionSnapshots.length > keepCount) {
            sessionSnapshots.sort();
            const toDelete = sessionSnapshots.slice(0, sessionSnapshots.length - keepCount);
            
            for (const file of toDelete) {
                await fs.unlink(path.join(snapshotDir, file));
            }
        }
    }

    async readFromFile(filePath) {
        try {
            const data = await fs.readFile(filePath, 'utf8');
            const parsed = JSON.parse(data);
            
            if (this.encryptionEnabled) {
                return this.decrypt(parsed);
            }
            
            return parsed;
        } catch (error) {
            if (error.code === 'ENOENT') {
                return null;
            }
            throw error;
        }
    }

    async writeToFile(filePath, data) {
        try {
            let dataToWrite = data;
            
            if (this.encryptionEnabled) {
                dataToWrite = this.encrypt(data);
            }
            
            const jsonData = JSON.stringify(dataToWrite, null, 2);
            await fs.writeFile(filePath, jsonData, 'utf8');
        } catch (error) {
            throw error;
        }
    }

    sanitizeState(state) {
        // Remove sensitive data and ensure state is serializable
        const sanitized = JSON.parse(JSON.stringify(state));
        
        // Remove any potential sensitive fields
        const sensitiveFields = ['password', 'token', 'key', 'secret'];
        this.removeSensitiveFields(sanitized, sensitiveFields);
        
        return sanitized;
    }

    removeSensitiveFields(obj, sensitiveFields) {
        if (typeof obj !== 'object' || obj === null) return;
        
        for (const key in obj) {
            if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
                delete obj[key];
            } else if (typeof obj[key] === 'object') {
                this.removeSensitiveFields(obj[key], sensitiveFields);
            }
        }
    }

    calculateChecksum(data) {
        const dataString = JSON.stringify(data);
        return crypto.createHash('sha256').update(dataString).digest('hex');
    }

    validateChecksum(stateData) {
        if (!stateData.metadata || !stateData.metadata.checksum) {
            return false;
        }
        
        const calculatedChecksum = this.calculateChecksum(stateData.state);
        return calculatedChecksum === stateData.metadata.checksum;
    }

    validateStateIntegrity(stateData) {
        // Basic validation - could be expanded
        return stateData && 
               stateData.sessionId && 
               stateData.timestamp && 
               stateData.state;
    }

    encrypt(data) {
        // Simple encryption implementation - in production, use proper encryption
        if (!this.encryptionKey) {
            throw new Error('Encryption key not set');
        }
        // Implementation would go here
        return data;
    }

    decrypt(data) {
        // Simple decryption implementation - in production, use proper decryption
        if (!this.encryptionKey) {
            throw new Error('Encryption key not set');
        }
        // Implementation would go here
        return data;
    }
}

module.exports = SessionStatePersistence;
