"""
Main client for the Cursor Telemetry SDK
"""

import asyncio
import json
from typing import Dict, List, Optional, Any, Callable
import requests
import websockets
from .types import (
    CursorTelemetryConfig,
    Session,
    Memory,
    Analytics,
    ExportOptions,
    ExportResult,
    PaginationOptions,
    SearchOptions,
    WebSocketEvent,
    WebSocketConfig,
    NotebookGenerationOptions,
    MemoryCreationOptions,
    ExecutionContext,
    ExecutionResult,
    CursorTelemetryError,
    AuthenticationError,
    RateLimitError,
    ValidationError,
    NotFoundError,
    ServerError,
)


class CursorTelemetryAPI:
    """Main API client for Cursor Telemetry"""
    
    def __init__(self, config: CursorTelemetryConfig):
        self.config = config
        self.session = requests.Session()
        self._setup_session()
        self._websocket = None
        self._event_handlers: Dict[str, List[Callable]] = {}
    
    def _setup_session(self):
        """Setup the requests session with authentication and headers"""
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'cursor-telemetry-sdk/1.0.0'
        })
        
        if self.config.api_key:
            self.session.headers['Authorization'] = f'Bearer {self.config.api_key}'
    
    def _make_request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        """Make HTTP request with error handling"""
        url = f"{self.config.base_url.rstrip('/')}/api{endpoint}"
        
        try:
            response = self.session.request(
                method,
                url,
                timeout=self.config.timeout,
                **kwargs
            )
            
            # Handle different status codes
            if response.status_code == 401:
                raise AuthenticationError("Authentication failed")
            elif response.status_code == 429:
                retry_after = response.headers.get('Retry-After')
                raise RateLimitError(
                    "Rate limit exceeded",
                    retry_after=int(retry_after) if retry_after else None
                )
            elif response.status_code == 400:
                raise ValidationError("Bad request")
            elif response.status_code == 404:
                raise NotFoundError("Resource not found")
            elif response.status_code >= 500:
                raise ServerError("Internal server error")
            
            response.raise_for_status()
            return response.json()
            
        except requests.exceptions.RequestException as e:
            raise CursorTelemetryError(f"Request failed: {str(e)}")
    
    # Sessions API
    def get_sessions(self, options: Optional[PaginationOptions] = None) -> List[Session]:
        """Get all sessions"""
        params = {}
        if options:
            if options.limit:
                params['limit'] = options.limit
            if options.offset:
                params['offset'] = options.offset
            if options.sort_by:
                params['sortBy'] = options.sort_by
            if options.sort_order:
                params['sortOrder'] = options.sort_order
        
        response = self._make_request('GET', '/sessions', params=params)
        return [Session(**session) for session in response.get('data', [])]
    
    def search_sessions(self, options: SearchOptions) -> List[Session]:
        """Search sessions"""
        params = {'q': options.query}
        
        if options.limit:
            params['limit'] = options.limit
        if options.offset:
            params['offset'] = options.offset
        if options.sort_by:
            params['sortBy'] = options.sort_by
        if options.sort_order:
            params['sortOrder'] = options.sort_order
        if options.filters:
            for key, value in options.filters.items():
                params[f'filter[{key}]'] = value
        if options.date_range:
            if options.date_range.get('start'):
                params['start'] = options.date_range['start']
            if options.date_range.get('end'):
                params['end'] = options.date_range['end']
        
        response = self._make_request('GET', '/sessions/search', params=params)
        return [Session(**session) for session in response.get('data', [])]
    
    def get_session(self, session_id: str) -> Session:
        """Get session by ID"""
        response = self._make_request('GET', f'/sessions/{session_id}')
        return Session(**response.get('data', {}))
    
    def generate_notebook(
        self,
        session_id: str,
        options: Optional[NotebookGenerationOptions] = None
    ) -> Memory:
        """Generate notebook from session"""
        data = {}
        if options:
            data = {
                'includeMetadata': options.include_metadata,
                'format': options.format,
                'addCells': options.add_cells,
                'includeAnalysis': options.include_analysis,
                'template': options.template
            }
        
        response = self._make_request('POST', f'/sessions/{session_id}/generate-notebook', json=data)
        return Memory(**response.get('data', {}))
    
    def create_memory(
        self,
        session_id: str,
        options: MemoryCreationOptions
    ) -> Memory:
        """Create executable memory from session"""
        data = {
            'name': options.name,
            'type': options.type,
            'tags': options.tags or [],
            'description': options.description,
            'includeMemories': options.include_memories,
            'includeASTAnalysis': options.include_ast_analysis,
            'includeKuraAnalysis': options.include_kura_analysis,
            'pklFeatures': options.pkl_features
        }
        
        response = self._make_request('POST', f'/sessions/{session_id}/create-memory', json=data)
        return Memory(**response.get('data', {}))
    
    # Memory API
    def get_memories(self, options: Optional[PaginationOptions] = None) -> List[Memory]:
        """Get all memories"""
        params = {}
        if options:
            if options.limit:
                params['limit'] = options.limit
            if options.offset:
                params['offset'] = options.offset
            if options.sort_by:
                params['sortBy'] = options.sort_by
            if options.sort_order:
                params['sortOrder'] = options.sort_order
        
        response = self._make_request('GET', '/memories', params=params)
        return [Memory(**memory) for memory in response.get('data', [])]
    
    def search_memories(self, options: SearchOptions) -> List[Memory]:
        """Search memories"""
        params = {'q': options.query}
        
        if options.limit:
            params['limit'] = options.limit
        if options.offset:
            params['offset'] = options.offset
        if options.sort_by:
            params['sortBy'] = options.sort_by
        if options.sort_order:
            params['sortOrder'] = options.sort_order
        if options.filters:
            for key, value in options.filters.items():
                params[f'filter[{key}]'] = value
        if options.date_range:
            if options.date_range.get('start'):
                params['start'] = options.date_range['start']
            if options.date_range.get('end'):
                params['end'] = options.date_range['end']
        
        response = self._make_request('GET', '/memories/search', params=params)
        return [Memory(**memory) for memory in response.get('data', [])]
    
    def get_memory(self, memory_id: str) -> Memory:
        """Get memory by ID"""
        response = self._make_request('GET', f'/memories/{memory_id}')
        return Memory(**response.get('data', {}))
    
    def execute_memory(
        self,
        memory_id: str,
        context: Optional[ExecutionContext] = None
    ) -> ExecutionResult:
        """Execute a stored memory"""
        data = {}
        if context:
            data = {
                'targetDirectory': context.target_directory,
                'parameters': context.parameters,
                'environment': context.environment,
                'options': context.options
            }
        
        response = self._make_request('POST', f'/memories/{memory_id}/execute', json=data)
        return ExecutionResult(**response.get('data', {}))
    
    # Analytics API
    def get_stats(self) -> Analytics:
        """Get system statistics"""
        response = self._make_request('GET', '/stats')
        return Analytics(**response.get('data', {}))
    
    def get_analytics(self) -> Dict[str, Any]:
        """Get analytics data"""
        response = self._make_request('GET', '/analytics')
        return response.get('data', {})
    
    # WebSocket support
    async def connect_websocket(self, config: Optional[WebSocketConfig] = None):
        """Connect to WebSocket for real-time updates"""
        if config is None:
            config = WebSocketConfig()
        
        ws_url = self.config.base_url.replace('http', 'ws') + '/ws'
        
        try:
            self._websocket = await websockets.connect(ws_url)
            
            if config.on_connect:
                config.on_connect()
            
            # Start listening for messages
            asyncio.create_task(self._listen_for_messages())
            
        except Exception as e:
            if config.on_error:
                config.on_error(e)
            raise CursorTelemetryError(f"WebSocket connection failed: {str(e)}")
    
    async def _listen_for_messages(self):
        """Listen for WebSocket messages"""
        try:
            async for message in self._websocket:
                data = json.loads(message)
                event = WebSocketEvent(**data)
                
                # Call registered handlers
                handlers = self._event_handlers.get(event.type, [])
                for handler in handlers:
                    try:
                        handler(event.data)
                    except Exception as e:
                        print(f"Error in event handler: {e}")
                        
        except websockets.exceptions.ConnectionClosed:
            print("WebSocket connection closed")
        except Exception as e:
            print(f"WebSocket error: {e}")
    
    def on(self, event_type: str, handler: Callable):
        """Register event handler"""
        if event_type not in self._event_handlers:
            self._event_handlers[event_type] = []
        self._event_handlers[event_type].append(handler)
    
    def off(self, event_type: str, handler: Callable):
        """Unregister event handler"""
        if event_type in self._event_handlers:
            try:
                self._event_handlers[event_type].remove(handler)
            except ValueError:
                pass
    
    async def disconnect_websocket(self):
        """Disconnect from WebSocket"""
        if self._websocket:
            await self._websocket.close()
            self._websocket = None
    
    # Utility methods
    def health_check(self) -> bool:
        """Check API health"""
        try:
            response = self._make_request('GET', '/health')
            return response.get('status') == 'ok'
        except Exception:
            return False
    
    def update_config(self, new_config: Dict[str, Any]):
        """Update configuration"""
        for key, value in new_config.items():
            if hasattr(self.config, key):
                setattr(self.config, key, value)
        
        # Update session headers if API key changed
        if 'api_key' in new_config:
            self._setup_session()


def create_client(
    base_url: str = "http://localhost:3000",
    api_key: Optional[str] = None,
    **kwargs
) -> CursorTelemetryAPI:
    """
    Create a Cursor Telemetry API client.
    
    Args:
        base_url: The base URL of the Cursor Telemetry API
        api_key: Optional API key for authentication
        **kwargs: Additional configuration options
        
    Returns:
        CursorTelemetryAPI: Configured API client
    """
    config = CursorTelemetryConfig(
        base_url=base_url,
        api_key=api_key,
        **kwargs
    )
    return CursorTelemetryAPI(config)
