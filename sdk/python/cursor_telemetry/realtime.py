"""
Real-time WebSocket client for Cursor Telemetry SDK
"""

import asyncio
import json
import logging
import websockets
from typing import Dict, List, Callable, Optional, Any
from dataclasses import dataclass
from datetime import datetime
import threading
import time

logger = logging.getLogger(__name__)

@dataclass
class WebSocketEvent:
    """WebSocket event data structure"""
    type: str
    data: Dict[str, Any]
    timestamp: datetime
    source: str = "websocket"

class RealTimeClient:
    """Real-time WebSocket client for Cursor Telemetry"""
    
    def __init__(self, base_url: str = "ws://localhost:3000", api_key: Optional[str] = None):
        self.base_url = base_url.replace("http://", "ws://").replace("https://", "wss://")
        self.api_key = api_key
        self.websocket = None
        self.is_connected = False
        self.event_handlers: Dict[str, List[Callable]] = {}
        self.subscriptions: set = set()
        self.reconnect_attempts = 0
        self.max_reconnect_attempts = 5
        self.reconnect_delay = 1
        self.heartbeat_interval = 30
        self.last_heartbeat = time.time()
        self._stop_event = threading.Event()
        self._event_loop = None
        self._websocket_task = None
        
    async def connect(self) -> bool:
        """Connect to WebSocket server"""
        try:
            headers = {}
            if self.api_key:
                headers["Authorization"] = f"Bearer {self.api_key}"
                
            self.websocket = await websockets.connect(
                self.base_url,
                extra_headers=headers,
                ping_interval=20,
                ping_timeout=10
            )
            
            self.is_connected = True
            self.reconnect_attempts = 0
            
            logger.info(f"Connected to WebSocket at {self.base_url}")
            
            # Start listening for messages
            asyncio.create_task(self._listen_for_messages())
            
            # Start heartbeat
            asyncio.create_task(self._heartbeat())
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to connect to WebSocket: {e}")
            return False
    
    async def disconnect(self):
        """Disconnect from WebSocket server"""
        self.is_connected = False
        self._stop_event.set()
        
        if self.websocket:
            await self.websocket.close()
            self.websocket = None
            
        logger.info("Disconnected from WebSocket")
    
    async def _listen_for_messages(self):
        """Listen for incoming WebSocket messages"""
        try:
            async for message in self.websocket:
                if self._stop_event.is_set():
                    break
                    
                try:
                    data = json.loads(message)
                    await self._handle_message(data)
                except json.JSONDecodeError:
                    logger.warning(f"Received non-JSON message: {message}")
                except Exception as e:
                    logger.error(f"Error handling message: {e}")
                    
        except websockets.exceptions.ConnectionClosed:
            logger.warning("WebSocket connection closed")
            if not self._stop_event.is_set():
                await self._attempt_reconnect()
        except Exception as e:
            logger.error(f"Error in message listener: {e}")
            if not self._stop_event.is_set():
                await self._attempt_reconnect()
    
    async def _handle_message(self, data: Dict[str, Any]):
        """Handle incoming WebSocket message"""
        event_type = data.get("type", "unknown")
        event_data = data.get("data", {})
        timestamp = datetime.fromisoformat(data.get("timestamp", datetime.now().isoformat()))
        
        event = WebSocketEvent(
            type=event_type,
            data=event_data,
            timestamp=timestamp,
            source=data.get("source", "websocket")
        )
        
        # Call registered handlers
        if event_type in self.event_handlers:
            for handler in self.event_handlers[event_type]:
                try:
                    if asyncio.iscoroutinefunction(handler):
                        await handler(event)
                    else:
                        handler(event)
                except Exception as e:
                    logger.error(f"Error in event handler for {event_type}: {e}")
        
        # Call wildcard handlers
        if "*" in self.event_handlers:
            for handler in self.event_handlers["*"]:
                try:
                    if asyncio.iscoroutinefunction(handler):
                        await handler(event)
                    else:
                        handler(event)
                except Exception as e:
                    logger.error(f"Error in wildcard event handler: {e}")
    
    async def _heartbeat(self):
        """Send periodic heartbeat to keep connection alive"""
        while self.is_connected and not self._stop_event.is_set():
            try:
                await asyncio.sleep(self.heartbeat_interval)
                
                if self.websocket and not self.websocket.closed:
                    await self.websocket.ping()
                    self.last_heartbeat = time.time()
                else:
                    logger.warning("WebSocket connection lost during heartbeat")
                    break
                    
            except Exception as e:
                logger.error(f"Heartbeat error: {e}")
                break
    
    async def _attempt_reconnect(self):
        """Attempt to reconnect to WebSocket"""
        if self.reconnect_attempts >= self.max_reconnect_attempts:
            logger.error("Max reconnection attempts reached")
            return
        
        self.reconnect_attempts += 1
        delay = self.reconnect_delay * (2 ** (self.reconnect_attempts - 1))
        
        logger.info(f"Attempting to reconnect in {delay} seconds (attempt {self.reconnect_attempts})")
        await asyncio.sleep(delay)
        
        if not self._stop_event.is_set():
            await self.connect()
    
    def on(self, event_type: str, handler: Callable):
        """Register event handler"""
        if event_type not in self.event_handlers:
            self.event_handlers[event_type] = []
        self.event_handlers[event_type].append(handler)
    
    def off(self, event_type: str, handler: Callable):
        """Unregister event handler"""
        if event_type in self.event_handlers:
            try:
                self.event_handlers[event_type].remove(handler)
            except ValueError:
                pass
    
    async def emit(self, event_type: str, data: Dict[str, Any]):
        """Emit event to server"""
        if not self.is_connected or not self.websocket:
            logger.warning("Cannot emit event: not connected")
            return
        
        message = {
            "type": event_type,
            "data": data,
            "timestamp": datetime.now().isoformat()
        }
        
        try:
            await self.websocket.send(json.dumps(message))
        except Exception as e:
            logger.error(f"Failed to emit event: {e}")
    
    def subscribe(self, event_type: str):
        """Subscribe to specific event type"""
        self.subscriptions.add(event_type)
        asyncio.create_task(self.emit("subscribe", {"event": event_type}))
    
    def unsubscribe(self, event_type: str):
        """Unsubscribe from event type"""
        self.subscriptions.discard(event_type)
        asyncio.create_task(self.emit("unsubscribe", {"event": event_type}))
    
    # Convenience methods for common events
    def on_sessions_updated(self, handler: Callable):
        """Handle sessions updated events"""
        self.on("sessions-update", handler)
    
    def on_session_created(self, handler: Callable):
        """Handle session created events"""
        self.on("session-created", handler)
    
    def on_file_changed(self, handler: Callable):
        """Handle file change events"""
        self.on("file-change", handler)
    
    def on_conversation_detected(self, handler: Callable):
        """Handle conversation detected events"""
        self.on("conversation-detected", handler)
    
    def on_real_time_update(self, handler: Callable):
        """Handle real-time update events"""
        self.on("real-time-update", handler)
    
    def on_system_resources(self, handler: Callable):
        """Handle system resource events"""
        self.on("system-resources", handler)
    
    def on_process_change(self, handler: Callable):
        """Handle process change events"""
        self.on("process-change", handler)
    
    async def request_analysis(self, session_id: str):
        """Request analysis for a session"""
        await self.emit("request-analysis", {"sessionId": session_id})
    
    async def request_sessions(self):
        """Request current sessions"""
        await self.emit("request-sessions", {})
    
    async def request_live_durations(self):
        """Request live session durations"""
        await self.emit("request-live-durations", {})
    
    def get_connection_status(self) -> Dict[str, Any]:
        """Get connection status information"""
        return {
            "is_connected": self.is_connected,
            "reconnect_attempts": self.reconnect_attempts,
            "last_heartbeat": self.last_heartbeat,
            "subscriptions": list(self.subscriptions),
            "event_handlers": list(self.event_handlers.keys())
        }

class RealTimeManager:
    """Manager for real-time connections"""
    
    def __init__(self, base_url: str = "ws://localhost:3000", api_key: Optional[str] = None):
        self.base_url = base_url
        self.api_key = api_key
        self.clients: List[RealTimeClient] = []
        self._event_loop = None
        self._running = False
    
    async def create_client(self) -> RealTimeClient:
        """Create and connect a new real-time client"""
        client = RealTimeClient(self.base_url, self.api_key)
        await client.connect()
        self.clients.append(client)
        return client
    
    async def start(self):
        """Start the real-time manager"""
        if self._running:
            return
        
        self._running = True
        self._event_loop = asyncio.get_event_loop()
        
        # Create initial client
        await self.create_client()
        
        logger.info("Real-time manager started")
    
    async def stop(self):
        """Stop the real-time manager"""
        if not self._running:
            return
        
        self._running = False
        
        # Disconnect all clients
        for client in self.clients:
            await client.disconnect()
        
        self.clients.clear()
        logger.info("Real-time manager stopped")
    
    def get_client(self, index: int = 0) -> Optional[RealTimeClient]:
        """Get a specific client by index"""
        if 0 <= index < len(self.clients):
            return self.clients[index]
        return None
    
    def get_all_clients(self) -> List[RealTimeClient]:
        """Get all connected clients"""
        return self.clients.copy()
    
    async def broadcast(self, event_type: str, data: Dict[str, Any]):
        """Broadcast event to all clients"""
        for client in self.clients:
            if client.is_connected:
                await client.emit(event_type, data)
    
    def get_status(self) -> Dict[str, Any]:
        """Get status of all clients"""
        return {
            "total_clients": len(self.clients),
            "connected_clients": sum(1 for client in self.clients if client.is_connected),
            "clients": [client.get_connection_status() for client in self.clients]
        }
