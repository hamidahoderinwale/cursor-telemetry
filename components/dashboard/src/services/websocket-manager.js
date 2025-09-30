/**
 * WebSocket Connection Manager
 * Handles WebSocket connections with automatic reconnection, error handling, and crash prevention
 */

const { EventEmitter } = require('events');
const { Server } = require('socket.io');

class WebSocketManager extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            port: options.port || 3000,
            cors: options.cors || {
                origin: "*",
                methods: ["GET", "POST"]
            },
            maxConnections: options.maxConnections || 1000,
            connectionTimeout: options.connectionTimeout || 30000,
            heartbeatInterval: options.heartbeatInterval || 30000,
            maxReconnectAttempts: options.maxReconnectAttempts || 5,
            reconnectDelay: options.reconnectDelay || 1000,
            enableCompression: options.enableCompression !== false,
            enableBinary: options.enableBinary !== false,
            ...options
        };
        
        this.io = null;
        this.connections = new Map();
        this.connectionStats = {
            total: 0,
            active: 0,
            failed: 0,
            reconnected: 0,
            disconnected: 0
        };
        
        this.heartbeatInterval = null;
        this.cleanupInterval = null;
        this.isRunning = false;
        this.reconnectAttempts = 0;
        
        this.setupErrorHandlers();
    }
    
    /**
     * Setup error handlers
     */
    setupErrorHandlers() {
        process.on('uncaughtException', (error) => {
            this.handleUncaughtException(error);
        });
        
        process.on('unhandledRejection', (reason, promise) => {
            this.handleUnhandledRejection(reason, promise);
        });
    }
    
    /**
     * Handle uncaught exceptions
     */
    handleUncaughtException(error) {
        console.error('Uncaught Exception:', error);
        this.emit('error', {
            type: 'uncaught-exception',
            error: error
        });
        
        // Don't exit, try to recover
        this.recoverFromError();
    }
    
    /**
     * Handle unhandled promise rejections
     */
    handleUnhandledRejection(reason, promise) {
        console.error('Unhandled Rejection at:', promise, 'reason:', reason);
        this.emit('error', {
            type: 'unhandled-rejection',
            reason: reason,
            promise: promise
        });
    }
    
    /**
     * Start WebSocket server
     */
    async start(server) {
        if (this.isRunning) {
            console.log('WebSocket server already running');
            return;
        }
        
        try {
            this.io = new Server(server, {
                cors: this.options.cors,
                maxHttpBufferSize: 1e6, // 1MB
                pingTimeout: 60000,
                pingInterval: 25000,
                transports: ['websocket', 'polling'],
                allowEIO3: true
            });
            
            this.setupEventHandlers();
            this.startHeartbeat();
            this.startCleanup();
            
            this.isRunning = true;
            this.reconnectAttempts = 0;
            
            console.log(`WebSocket server started on port ${this.options.port}`);
            this.emit('started', { port: this.options.port });
            
        } catch (error) {
            console.error('Failed to start WebSocket server:', error);
            this.emit('error', {
                type: 'startup-error',
                error: error
            });
            throw error;
        }
    }
    
    /**
     * Stop WebSocket server
     */
    async stop() {
        if (!this.isRunning) return;
        
        try {
            // Disconnect all clients gracefully
            if (this.io) {
                this.io.disconnectSockets(true);
                this.io.close();
            }
            
            this.stopHeartbeat();
            this.stopCleanup();
            
            this.connections.clear();
            this.isRunning = false;
            
            console.log('WebSocket server stopped');
            this.emit('stopped');
            
        } catch (error) {
            console.error('Error stopping WebSocket server:', error);
            this.emit('error', {
                type: 'stop-error',
                error: error
            });
        }
    }
    
    /**
     * Setup event handlers
     */
    setupEventHandlers() {
        this.io.on('connection', (socket) => {
            this.handleConnection(socket);
        });
        
        this.io.engine.on('connection_error', (error) => {
            this.handleConnectionError(error);
        });
    }
    
    /**
     * Handle new connection
     */
    handleConnection(socket) {
        const connectionId = socket.id;
        const clientInfo = {
            id: connectionId,
            ip: socket.handshake.address,
            userAgent: socket.handshake.headers['user-agent'],
            connectedAt: Date.now(),
            lastActivity: Date.now(),
            reconnectCount: 0,
            isAlive: true
        };
        
        // Check connection limits
        if (this.connections.size >= this.options.maxConnections) {
            socket.emit('error', { message: 'Server at capacity' });
            socket.disconnect(true);
            return;
        }
        
        this.connections.set(connectionId, clientInfo);
        this.connectionStats.total++;
        this.connectionStats.active++;
        
        console.log(`Client connected: ${connectionId} (${clientInfo.ip})`);
        this.emit('client-connected', clientInfo);
        
        // Setup socket event handlers
        this.setupSocketHandlers(socket, clientInfo);
        
        // Send welcome message
        socket.emit('welcome', {
            id: connectionId,
            serverTime: Date.now(),
            maxConnections: this.options.maxConnections
        });
    }
    
    /**
     * Setup socket event handlers
     */
    setupSocketHandlers(socket, clientInfo) {
        // Handle pong responses
        socket.on('pong', () => {
            clientInfo.isAlive = true;
            clientInfo.lastActivity = Date.now();
        });
        
        // Handle custom events
        socket.on('message', (data) => {
            this.handleMessage(socket, data, clientInfo);
        });
        
        socket.on('request-data', (data) => {
            this.handleDataRequest(socket, data, clientInfo);
        });
        
        socket.on('error', (error) => {
            this.handleSocketError(socket, error, clientInfo);
        });
        
        // Handle disconnection
        socket.on('disconnect', (reason) => {
            this.handleDisconnection(socket, reason, clientInfo);
        });
        
        // Handle reconnection
        socket.on('reconnect', (data) => {
            this.handleReconnection(socket, data, clientInfo);
        });
    }
    
    /**
     * Handle incoming messages
     */
    handleMessage(socket, data, clientInfo) {
        try {
            clientInfo.lastActivity = Date.now();
            
            // Validate message
            if (!this.validateMessage(data)) {
                socket.emit('error', { message: 'Invalid message format' });
                return;
            }
            
            // Process message
            this.emit('message', {
                socket: socket,
                data: data,
                client: clientInfo
            });
            
        } catch (error) {
            console.error('Error handling message:', error);
            socket.emit('error', { message: 'Message processing failed' });
        }
    }
    
    /**
     * Handle data requests
     */
    handleDataRequest(socket, data, clientInfo) {
        try {
            clientInfo.lastActivity = Date.now();
            
            this.emit('data-request', {
                socket: socket,
                data: data,
                client: clientInfo
            });
            
        } catch (error) {
            console.error('Error handling data request:', error);
            socket.emit('error', { message: 'Data request failed' });
        }
    }
    
    /**
     * Handle socket errors
     */
    handleSocketError(socket, error, clientInfo) {
        console.error(`Socket error for ${clientInfo.id}:`, error);
        
        this.connectionStats.failed++;
        
        this.emit('socket-error', {
            socket: socket,
            error: error,
            client: clientInfo
        });
    }
    
    /**
     * Handle disconnection
     */
    handleDisconnection(socket, reason, clientInfo) {
        this.connections.delete(clientInfo.id);
        this.connectionStats.active--;
        this.connectionStats.disconnected++;
        
        console.log(`Client disconnected: ${clientInfo.id} (${reason})`);
        
        this.emit('client-disconnected', {
            client: clientInfo,
            reason: reason
        });
    }
    
    /**
     * Handle reconnection
     */
    handleReconnection(socket, data, clientInfo) {
        clientInfo.reconnectCount++;
        clientInfo.lastActivity = Date.now();
        this.connectionStats.reconnected++;
        
        console.log(`Client reconnected: ${clientInfo.id} (attempt ${clientInfo.reconnectCount})`);
        
        this.emit('client-reconnected', {
            client: clientInfo,
            data: data
        });
    }
    
    /**
     * Handle connection errors
     */
    handleConnectionError(error) {
        console.error('Connection error:', error);
        
        this.emit('connection-error', {
            error: error
        });
    }
    
    /**
     * Validate message format
     */
    validateMessage(data) {
        if (!data || typeof data !== 'object') {
            return false;
        }
        
        // Add more validation as needed
        return true;
    }
    
    /**
     * Start heartbeat mechanism
     */
    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            this.performHeartbeat();
        }, this.options.heartbeatInterval);
    }
    
    /**
     * Stop heartbeat mechanism
     */
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }
    
    /**
     * Perform heartbeat check
     */
    performHeartbeat() {
        if (!this.io) return;
        
        const now = Date.now();
        const timeout = this.options.connectionTimeout;
        
        for (const [connectionId, clientInfo] of this.connections) {
            if (now - clientInfo.lastActivity > timeout) {
                // Client is unresponsive, disconnect
                const socket = this.io.sockets.sockets.get(connectionId);
                if (socket) {
                    socket.disconnect(true);
                }
                
                this.connections.delete(connectionId);
                this.connectionStats.active--;
                
                console.log(`Disconnected unresponsive client: ${connectionId}`);
            } else {
                // Send ping
                const socket = this.io.sockets.sockets.get(connectionId);
                if (socket) {
                    socket.emit('ping');
                }
            }
        }
    }
    
    /**
     * Start cleanup interval
     */
    startCleanup() {
        this.cleanupInterval = setInterval(() => {
            this.performCleanup();
        }, 60000); // Cleanup every minute
    }
    
    /**
     * Stop cleanup interval
     */
    stopCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }
    
    /**
     * Perform cleanup
     */
    performCleanup() {
        // Clean up old connection data
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        
        for (const [connectionId, clientInfo] of this.connections) {
            if (now - clientInfo.connectedAt > maxAge) {
                // Force disconnect old connections
                const socket = this.io.sockets.sockets.get(connectionId);
                if (socket) {
                    socket.disconnect(true);
                }
            }
        }
    }
    
    /**
     * Broadcast message to all clients
     */
    broadcast(event, data) {
        if (!this.io) return;
        
        this.io.emit(event, data);
    }
    
    /**
     * Send message to specific client
     */
    sendToClient(clientId, event, data) {
        if (!this.io) return;
        
        const socket = this.io.sockets.sockets.get(clientId);
        if (socket) {
            socket.emit(event, data);
        }
    }
    
    /**
     * Send message to multiple clients
     */
    sendToClients(clientIds, event, data) {
        if (!this.io) return;
        
        for (const clientId of clientIds) {
            this.sendToClient(clientId, event, data);
        }
    }
    
    /**
     * Get connection statistics
     */
    getConnectionStats() {
        return {
            ...this.connectionStats,
            activeConnections: this.connections.size,
            isRunning: this.isRunning
        };
    }
    
    /**
     * Get client information
     */
    getClientInfo(clientId) {
        return this.connections.get(clientId) || null;
    }
    
    /**
     * Get all active clients
     */
    getActiveClients() {
        return Array.from(this.connections.values());
    }
    
    /**
     * Recover from error
     */
    recoverFromError() {
        console.log('Attempting to recover from error...');
        
        // Try to restart the server
        if (this.reconnectAttempts < this.options.maxReconnectAttempts) {
            this.reconnectAttempts++;
            
            setTimeout(() => {
                this.emit('recovery-attempt', {
                    attempt: this.reconnectAttempts,
                    maxAttempts: this.options.maxReconnectAttempts
                });
            }, this.options.reconnectDelay * this.reconnectAttempts);
        } else {
            console.error('Max reconnection attempts reached');
            this.emit('recovery-failed');
        }
    }
    
    /**
     * Force disconnect all clients
     */
    forceDisconnectAll() {
        if (!this.io) return;
        
        this.io.disconnectSockets(true);
        this.connections.clear();
        this.connectionStats.active = 0;
        
        console.log('All clients force disconnected');
    }
    
    /**
     * Destroy WebSocket manager
     */
    destroy() {
        this.stop();
        this.removeAllListeners();
    }
}

module.exports = WebSocketManager;
