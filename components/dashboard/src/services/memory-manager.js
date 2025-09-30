/**
 * Memory Manager
 * Prevents memory leaks and manages memory usage across the application
 */

const { EventEmitter } = require('events');
const os = require('os');

class MemoryManager extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            maxMemoryUsage: options.maxMemoryUsage || 500 * 1024 * 1024, // 500MB max
            warningThreshold: options.warningThreshold || 0.8, // 80% warning
            criticalThreshold: options.criticalThreshold || 0.9, // 90% critical
            gcInterval: options.gcInterval || 60000, // 1 minute
            monitoringInterval: options.monitoringInterval || 30000, // 30 seconds
            enableAutoGC: options.enableAutoGC !== false,
            enableMemoryTracking: options.enableMemoryTracking !== false,
            ...options
        };
        
        this.memoryUsage = {
            current: 0,
            peak: 0,
            average: 0,
            samples: []
        };
        
        this.trackedObjects = new Map();
        this.weakRefs = new WeakMap();
        this.cleanupTasks = new Set();
        this.isMonitoring = false;
        this.stats = {
            gcRuns: 0,
            objectsCleaned: 0,
            memoryFreed: 0,
            warnings: 0,
            criticals: 0
        };
        
        this.startMonitoring();
    }
    
    /**
     * Start memory monitoring
     */
    startMonitoring() {
        if (this.isMonitoring) return;
        
        this.isMonitoring = true;
        
        // Memory monitoring interval
        this.monitoringInterval = setInterval(() => {
            this.checkMemoryUsage();
        }, this.options.monitoringInterval);
        
        // Auto garbage collection interval
        if (this.options.enableAutoGC) {
            this.gcInterval = setInterval(() => {
                this.performGarbageCollection();
            }, this.options.gcInterval);
        }
        
        this.emit('monitoring-started');
    }
    
    /**
     * Stop memory monitoring
     */
    stopMonitoring() {
        if (!this.isMonitoring) return;
        
        this.isMonitoring = false;
        
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        
        if (this.gcInterval) {
            clearInterval(this.gcInterval);
            this.gcInterval = null;
        }
        
        this.emit('monitoring-stopped');
    }
    
    /**
     * Check current memory usage
     */
    checkMemoryUsage() {
        const memUsage = process.memoryUsage();
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const usedMemory = totalMemory - freeMemory;
        
        const currentUsage = memUsage.heapUsed;
        const usagePercentage = currentUsage / this.options.maxMemoryUsage;
        
        // Update memory statistics
        this.memoryUsage.current = currentUsage;
        this.memoryUsage.peak = Math.max(this.memoryUsage.peak, currentUsage);
        
        // Add to samples for average calculation
        this.memoryUsage.samples.push(currentUsage);
        if (this.memoryUsage.samples.length > 100) {
            this.memoryUsage.samples.shift();
        }
        
        // Calculate average
        this.memoryUsage.average = this.memoryUsage.samples.reduce((a, b) => a + b, 0) / this.memoryUsage.samples.length;
        
        // Check thresholds
        if (usagePercentage >= this.options.criticalThreshold) {
            this.handleCriticalMemoryUsage(usagePercentage, currentUsage);
        } else if (usagePercentage >= this.options.warningThreshold) {
            this.handleWarningMemoryUsage(usagePercentage, currentUsage);
        }
        
        this.emit('memory-check', {
            current: currentUsage,
            peak: this.memoryUsage.peak,
            average: this.memoryUsage.average,
            percentage: usagePercentage,
            system: {
                total: totalMemory,
                used: usedMemory,
                free: freeMemory
            }
        });
    }
    
    /**
     * Handle warning memory usage
     */
    handleWarningMemoryUsage(percentage, currentUsage) {
        this.stats.warnings++;
        
        this.emit('memory-warning', {
            percentage: percentage,
            current: currentUsage,
            max: this.options.maxMemoryUsage
        });
        
        // Trigger cleanup tasks
        this.runCleanupTasks();
    }
    
    /**
     * Handle critical memory usage
     */
    handleCriticalMemoryUsage(percentage, currentUsage) {
        this.stats.criticals++;
        
        this.emit('memory-critical', {
            percentage: percentage,
            current: currentUsage,
            max: this.options.maxMemoryUsage
        });
        
        // Force garbage collection
        this.forceGarbageCollection();
        
        // Run all cleanup tasks
        this.runCleanupTasks();
        
        // Clear caches if still critical
        if (this.getMemoryUsagePercentage() >= this.options.criticalThreshold) {
            this.clearAllCaches();
        }
    }
    
    /**
     * Track object for memory management
     */
    trackObject(id, object, cleanupFn) {
        this.trackedObjects.set(id, {
            object: object,
            cleanupFn: cleanupFn,
            createdAt: Date.now(),
            lastAccessed: Date.now()
        });
        
        this.emit('object-tracked', { id: id });
    }
    
    /**
     * Untrack object
     */
    untrackObject(id) {
        const tracked = this.trackedObjects.get(id);
        if (tracked) {
            if (tracked.cleanupFn) {
                tracked.cleanupFn();
            }
            this.trackedObjects.delete(id);
            this.emit('object-untracked', { id: id });
        }
    }
    
    /**
     * Add cleanup task
     */
    addCleanupTask(taskFn, priority = 0) {
        this.cleanupTasks.add({
            fn: taskFn,
            priority: priority,
            addedAt: Date.now()
        });
    }
    
    /**
     * Remove cleanup task
     */
    removeCleanupTask(taskFn) {
        for (const task of this.cleanupTasks) {
            if (task.fn === taskFn) {
                this.cleanupTasks.delete(task);
                break;
            }
        }
    }
    
    /**
     * Run cleanup tasks
     */
    runCleanupTasks() {
        const tasks = Array.from(this.cleanupTasks)
            .sort((a, b) => b.priority - a.priority);
        
        for (const task of tasks) {
            try {
                task.fn();
                this.stats.objectsCleaned++;
            } catch (error) {
                this.emit('cleanup-error', {
                    error: error.message,
                    task: task.fn.name || 'anonymous'
                });
            }
        }
    }
    
    /**
     * Perform garbage collection
     */
    performGarbageCollection() {
        if (global.gc) {
            const beforeGC = process.memoryUsage().heapUsed;
            global.gc();
            const afterGC = process.memoryUsage().heapUsed;
            const freed = beforeGC - afterGC;
            
            this.stats.gcRuns++;
            this.stats.memoryFreed += freed;
            
            this.emit('garbage-collection', {
                before: beforeGC,
                after: afterGC,
                freed: freed
            });
        }
    }
    
    /**
     * Force garbage collection
     */
    forceGarbageCollection() {
        this.performGarbageCollection();
        
        // Also run cleanup tasks
        this.runCleanupTasks();
    }
    
    /**
     * Clear all caches
     */
    clearAllCaches() {
        this.emit('clear-caches-requested');
        
        // Clear tracked objects
        for (const [id, tracked] of this.trackedObjects) {
            if (tracked.cleanupFn) {
                tracked.cleanupFn();
            }
        }
        this.trackedObjects.clear();
        
        this.emit('caches-cleared');
    }
    
    /**
     * Get memory usage percentage
     */
    getMemoryUsagePercentage() {
        return this.memoryUsage.current / this.options.maxMemoryUsage;
    }
    
    /**
     * Get memory statistics
     */
    getMemoryStats() {
        const memUsage = process.memoryUsage();
        
        return {
            process: {
                rss: memUsage.rss,
                heapTotal: memUsage.heapTotal,
                heapUsed: memUsage.heapUsed,
                external: memUsage.external,
                arrayBuffers: memUsage.arrayBuffers
            },
            tracked: {
                current: this.memoryUsage.current,
                peak: this.memoryUsage.peak,
                average: this.memoryUsage.average,
                percentage: this.getMemoryUsagePercentage()
            },
            system: {
                total: os.totalmem(),
                free: os.freemem(),
                used: os.totalmem() - os.freemem()
            },
            stats: { ...this.stats },
            options: this.options
        };
    }
    
    /**
     * Create memory leak detector
     */
    createLeakDetector(name, checkInterval = 60000) {
        const detector = {
            name: name,
            objects: new Map(),
            checkInterval: null,
            
            track: (id, object) => {
                detector.objects.set(id, {
                    object: object,
                    createdAt: Date.now(),
                    lastAccessed: Date.now()
                });
            },
            
            untrack: (id) => {
                detector.objects.delete(id);
            },
            
            check: () => {
                const now = Date.now();
                const maxAge = 5 * 60 * 1000; // 5 minutes
                
                for (const [id, tracked] of detector.objects) {
                    if (now - tracked.lastAccessed > maxAge) {
                        detector.objects.delete(id);
                        this.emit('leak-detected', {
                            detector: name,
                            objectId: id,
                            age: now - tracked.createdAt
                        });
                    }
                }
            },
            
            start: () => {
                detector.checkInterval = setInterval(detector.check, checkInterval);
            },
            
            stop: () => {
                if (detector.checkInterval) {
                    clearInterval(detector.checkInterval);
                    detector.checkInterval = null;
                }
            }
        };
        
        detector.start();
        return detector;
    }
    
    /**
     * Destroy memory manager
     */
    destroy() {
        this.stopMonitoring();
        this.clearAllCaches();
        this.cleanupTasks.clear();
        this.removeAllListeners();
    }
}

module.exports = MemoryManager;
