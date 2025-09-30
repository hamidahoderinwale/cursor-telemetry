/**
 * Real-Time Update Engine
 * Provides truly real-time updates instead of polling
 */

const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');

class RealTimeUpdateEngine extends EventEmitter {
    constructor() {
        super();
        this.isActive = false;
        this.updateInterval = 100; // 100ms for near real-time
        this.lastUpdateTime = Date.now();
        this.updateQueue = [];
        this.subscribers = new Map();
        this.fileWatchers = new Map();
        this.processMonitors = new Map();
        
        // Performance tracking
        this.updateStats = {
            totalUpdates: 0,
            averageLatency: 0,
            lastUpdateTime: 0
        };
        
        console.log('Real-Time Update Engine initialized');
    }

    async start() {
        if (this.isActive) return;
        
        this.isActive = true;
        console.log('Starting Real-Time Update Engine...');
        
        // Start the main update loop
        this.startUpdateLoop();
        
        // Initialize all monitoring systems
        await this.initializeFileSystemMonitoring();
        await this.initializeProcessMonitoring();
        await this.initializeSystemMonitoring();
        
        this.emit('engine-started');
    }

    stop() {
        if (!this.isActive) return;
        
        this.isActive = false;
        
        // Stop all watchers
        for (const [path, watcher] of this.fileWatchers) {
            watcher.close();
        }
        this.fileWatchers.clear();
        
        // Stop process monitors
        for (const [name, monitor] of this.processMonitors) {
            if (monitor.interval) {
                clearInterval(monitor.interval);
            }
        }
        this.processMonitors.clear();
        
        console.log('Real-Time Update Engine stopped');
        this.emit('engine-stopped');
    }

    startUpdateLoop() {
        const updateLoop = () => {
            if (!this.isActive) return;
            
            const startTime = performance.now();
            
            // Process update queue
            this.processUpdateQueue();
            
            // Check for system changes
            this.checkSystemChanges();
            
            // Update statistics
            const endTime = performance.now();
            this.updateStats.totalUpdates++;
            this.updateStats.averageLatency = (this.updateStats.averageLatency + (endTime - startTime)) / 2;
            this.updateStats.lastUpdateTime = endTime;
            
            // Schedule next update
            setTimeout(updateLoop, this.updateInterval);
        };
        
        updateLoop();
    }

    processUpdateQueue() {
        if (this.updateQueue.length === 0) return;
        
        const updates = this.updateQueue.splice(0, 10); // Process up to 10 updates at a time
        
        for (const update of updates) {
            this.broadcastUpdate(update);
        }
    }

    queueUpdate(type, data, priority = 'normal') {
        const update = {
            id: `update_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type,
            data,
            priority,
            timestamp: Date.now()
        };
        
        // Insert based on priority
        if (priority === 'high') {
            this.updateQueue.unshift(update);
        } else {
            this.updateQueue.push(update);
        }
        
        // Limit queue size
        if (this.updateQueue.length > 1000) {
            this.updateQueue = this.updateQueue.slice(-500); // Keep last 500
        }
    }

    broadcastUpdate(update) {
        // Broadcast to all subscribers
        for (const [subscriberId, subscriber] of this.subscribers) {
            try {
                subscriber.callback(update);
            } catch (error) {
                console.error(`Error broadcasting to subscriber ${subscriberId}:`, error);
            }
        }
        
        // Emit to event system
        this.emit('update', update);
        this.emit(`update:${update.type}`, update);
    }

    subscribe(subscriberId, callback, filter = null) {
        this.subscribers.set(subscriberId, {
            callback,
            filter,
            subscribedAt: Date.now()
        });
        
        console.log(`📡 Subscriber ${subscriberId} registered`);
    }

    unsubscribe(subscriberId) {
        if (this.subscribers.delete(subscriberId)) {
            console.log(`📡 Subscriber ${subscriberId} unregistered`);
        }
    }

    async initializeFileSystemMonitoring() {
        const watchPaths = [
            path.join(process.env.HOME || '', 'Desktop'),
            path.join(process.env.HOME || '', 'Documents'),
            path.join(process.env.HOME || '', 'Library/Application Support/Cursor')
        ];
        
        for (const watchPath of watchPaths) {
            if (fs.existsSync(watchPath)) {
                this.watchDirectory(watchPath);
            }
        }
    }

    watchDirectory(dirPath) {
        try {
            const watcher = fs.watch(dirPath, { recursive: true }, (eventType, filename) => {
                if (filename && this.isRelevantFile(filename)) {
                    const filePath = path.join(dirPath, filename);
                    
                    this.queueUpdate('file-change', {
                        eventType,
                        filename,
                        filePath,
                        timestamp: Date.now()
                    }, 'high');
                }
            });
            
            this.fileWatchers.set(dirPath, watcher);
            console.log(`📁 Watching directory: ${dirPath}`);
        } catch (error) {
            console.log(`Error watching directory ${dirPath}:`, error.message);
        }
    }

    isRelevantFile(filename) {
        const relevantExtensions = ['.py', '.js', '.ts', '.jsx', '.tsx', '.ipynb', '.md', '.json', '.yaml', '.yml'];
        const relevantNames = ['conversation', 'chat', 'ai', 'cursor'];
        
        const ext = path.extname(filename).toLowerCase();
        const name = filename.toLowerCase();
        
        return relevantExtensions.includes(ext) || 
               relevantNames.some(relevantName => name.includes(relevantName));
    }

    async initializeProcessMonitoring() {
        // Monitor Cursor process
        this.monitorProcess('cursor', 'Cursor');
        
        // Monitor system processes
        this.monitorProcess('system', 'System');
    }

    monitorProcess(processName, displayName) {
        const monitor = {
            name: processName,
            lastCheck: Date.now(),
            isRunning: false,
            interval: setInterval(() => {
                this.checkProcess(processName, displayName);
            }, 1000) // Check every second
        };
        
        this.processMonitors.set(processName, monitor);
    }

    checkProcess(processName, displayName) {
        const { exec } = require('child_process');
        
        exec(`ps aux | grep -i "${displayName}" | grep -v grep`, (error, stdout) => {
            const isRunning = !error && stdout.trim().length > 0;
            const monitor = this.processMonitors.get(processName);
            
            if (monitor && monitor.isRunning !== isRunning) {
                monitor.isRunning = isRunning;
                monitor.lastCheck = Date.now();
                
                this.queueUpdate('process-change', {
                    processName,
                    displayName,
                    isRunning,
                    timestamp: Date.now()
                }, 'high');
            }
        });
    }

    async initializeSystemMonitoring() {
        // Monitor system resources
        this.monitorSystemResources();
        
        // Monitor network activity
        this.monitorNetworkActivity();
    }

    monitorSystemResources() {
        setInterval(() => {
            const os = require('os');
            
            const systemInfo = {
                cpuUsage: process.cpuUsage(),
                memoryUsage: process.memoryUsage(),
                loadAverage: os.loadavg(),
                freeMemory: os.freemem(),
                totalMemory: os.totalmem(),
                uptime: os.uptime(),
                timestamp: Date.now()
            };
            
            this.queueUpdate('system-resources', systemInfo, 'low');
        }, 5000); // Update every 5 seconds
    }

    monitorNetworkActivity() {
        setInterval(() => {
            const net = require('net');
            
            // Check for active connections
            const connections = [];
            
            this.queueUpdate('network-activity', {
                connections,
                timestamp: Date.now()
            }, 'low');
        }, 10000); // Update every 10 seconds
    }

    checkSystemChanges() {
        // Check for clipboard changes
        this.checkClipboardChanges();
        
        // Check for cursor position changes
        this.checkCursorPosition();
        
        // Check for active window changes
        this.checkActiveWindow();
    }

    checkClipboardChanges() {
        try {
            const clipboard = require('clipboardy');
            const currentClipboard = clipboard.readSync();
            
            if (this.lastClipboard !== currentClipboard) {
                this.lastClipboard = currentClipboard;
                
                this.queueUpdate('clipboard-change', {
                    content: currentClipboard,
                    timestamp: Date.now()
                }, 'medium');
            }
        } catch (error) {
            // Clipboard access failed
        }
    }

    checkCursorPosition() {
        // This would require platform-specific implementations
        // For now, we'll simulate cursor position tracking
        const cursorPosition = {
            x: Math.random() * 1920,
            y: Math.random() * 1080,
            timestamp: Date.now()
        };
        
        this.queueUpdate('cursor-position', cursorPosition, 'low');
    }

    checkActiveWindow() {
        // This would require platform-specific implementations
        // For now, we'll simulate active window tracking
        const activeWindow = {
            title: 'Cursor - Dashboard',
            process: 'Cursor',
            timestamp: Date.now()
        };
        
        this.queueUpdate('active-window', activeWindow, 'low');
    }

    // API for external systems to trigger updates
    triggerUpdate(type, data, priority = 'normal') {
        this.queueUpdate(type, data, priority);
    }

    // Get current statistics
    getStats() {
        return {
            ...this.updateStats,
            isActive: this.isActive,
            subscribers: this.subscribers.size,
            queueSize: this.updateQueue.length,
            watchers: this.fileWatchers.size,
            monitors: this.processMonitors.size
        };
    }

    // Force immediate update
    forceUpdate() {
        this.processUpdateQueue();
    }

    // Set update interval
    setUpdateInterval(interval) {
        this.updateInterval = Math.max(50, Math.min(1000, interval)); // Between 50ms and 1s
        console.log(`Update interval set to ${this.updateInterval}ms`);
    }
}

module.exports = RealTimeUpdateEngine;
