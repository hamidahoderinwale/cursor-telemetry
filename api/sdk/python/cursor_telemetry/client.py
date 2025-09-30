"""
Cursor Telemetry API Client
Main client class for interacting with the Cursor Telemetry API
"""

import asyncio
import json
from typing import Dict, List, Optional, Any, Union
from datetime import datetime
import requests
import websockets
from pydantic import BaseModel, Field

from .models import Session, Project, Event, Analytics, Memory, APIResponse
from .exceptions import CursorTelemetryError, APIError, ConnectionError, AuthenticationError


class CursorTelemetryConfig(BaseModel):
    """Configuration for Cursor Telemetry API client"""
    base_url: str = Field(..., description="Base URL of the API")
    api_key: Optional[str] = Field(None, description="API key for authentication")
    timeout: int = Field(30, description="Request timeout in seconds")
    retries: int = Field(3, description="Number of retries for failed requests")


class CursorTelemetryAPI:
    """
    Main client class for Cursor Telemetry API
    
    Provides methods for interacting with sessions, projects, analytics,
    memory generation, and real-time monitoring.
    """
    
    def __init__(self, config: Union[CursorTelemetryConfig, Dict[str, Any]]):
        """
        Initialize the Cursor Telemetry API client
        
        Args:
            config: Configuration object or dictionary
        """
        if isinstance(config, dict):
            config = CursorTelemetryConfig(**config)
        
        self.config = config
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': f'cursor-telemetry-sdk-python/{__version__}'
        })
        
        if self.config.api_key:
            self.session.headers['Authorization'] = f'Bearer {self.config.api_key}'
    
    def _make_request(self, method: str, endpoint: str, **kwargs) -> APIResponse:
        """Make HTTP request to the API"""
        url = f"{self.config.base_url}/api{endpoint}"
        
        try:
            response = self.session.request(
                method, 
                url, 
                timeout=self.config.timeout,
                **kwargs
            )
            response.raise_for_status()
            
            data = response.json()
            if not data.get('success', False):
                raise APIError(data.get('error', 'API request failed'))
            
            return APIResponse(**data)
            
        except requests.exceptions.RequestException as e:
            raise ConnectionError(f"Request failed: {str(e)}")
        except json.JSONDecodeError as e:
            raise APIError(f"Invalid JSON response: {str(e)}")
    
    # Sessions API
    def get_sessions(self) -> List[Session]:
        """Get all sessions"""
        response = self._make_request('GET', '/sessions')
        return [Session(**session) for session in response.data]
    
    def get_session(self, session_id: str) -> Session:
        """Get specific session by ID"""
        response = self._make_request('GET', f'/sessions/{session_id}')
        return Session(**response.data)
    
    def search_sessions(self, query: str) -> List[Session]:
        """Search sessions by query"""
        response = self._make_request('GET', '/sessions/search', params={'q': query})
        return [Session(**session) for session in response.data]
    
    def generate_notebook(self, session_id: str, **options) -> Memory:
        """Generate executable notebook from session"""
        response = self._make_request('POST', f'/sessions/{session_id}/generate-notebook', json=options)
        return Memory(**response.data)
    
    def create_session_file(self, session_id: str, **options) -> Memory:
        """Create .cursor-session file from session"""
        response = self._make_request('POST', f'/sessions/{session_id}/create-session-file', json=options)
        return Memory(**response.data)
    
    def create_integration_package(self, session_id: str, **options) -> Memory:
        """Create complete integration package from session"""
        response = self._make_request('POST', f'/sessions/{session_id}/create-integration-package', json=options)
        return Memory(**response.data)
    
    def get_session_visualizations(self, session_id: str) -> Dict[str, Any]:
        """Get visualizations for specific session"""
        response = self._make_request('GET', f'/sessions/{session_id}/visualizations')
        return response.data
    
    def get_session_conversations(self, session_id: str) -> List[Dict[str, Any]]:
        """Get conversations for specific session"""
        response = self._make_request('GET', f'/sessions/{session_id}/conversations')
        return response.data
    
    def get_session_suggestions(self, session_id: str) -> List[Dict[str, Any]]:
        """Get procedure suggestions for specific session"""
        response = self._make_request('GET', f'/sessions/{session_id}/suggestions')
        return response.data
    
    # Projects API
    def get_projects(self) -> List[Project]:
        """Get all projects"""
        response = self._make_request('GET', '/projects')
        return [Project(**project) for project in response.data]
    
    def get_project(self, project_id: str) -> Project:
        """Get specific project by ID"""
        response = self._make_request('GET', f'/projects/{project_id}')
        return Project(**response.data)
    
    def get_project_sessions(self, project_id: str) -> List[Session]:
        """Get sessions for specific project"""
        response = self._make_request('GET', f'/projects/{project_id}/sessions')
        return [Session(**session) for session in response.data]
    
    def open_project(self, path: str) -> None:
        """Open project in Cursor IDE"""
        self._make_request('POST', '/project/open', json={'path': path})
    
    # Analytics API
    def get_stats(self) -> Analytics:
        """Get system statistics"""
        response = self._make_request('GET', '/stats')
        return Analytics(**response.data)
    
    def get_visualizations(self) -> Dict[str, Any]:
        """Get visualization data"""
        response = self._make_request('GET', '/visualizations')
        return response.data
    
    def get_events(self) -> List[Event]:
        """Get development events"""
        response = self._make_request('GET', '/events')
        return [Event(**event) for event in response.data]
    
    def get_embeddings(self) -> List[Dict[str, Any]]:
        """Get session embeddings"""
        response = self._make_request('GET', '/embeddings')
        return response.data
    
    def get_live_durations(self) -> List[Dict[str, Any]]:
        """Get live session durations"""
        response = self._make_request('GET', '/sessions/live-durations')
        return response.data
    
    # Memory API
    def get_memories(self) -> List[Memory]:
        """Get all memories"""
        response = self._make_request('GET', '/memories')
        return [Memory(**memory) for memory in response.data]
    
    def create_memory(self, session_id: str, **options) -> Memory:
        """Create executable memory from session"""
        response = self._make_request('POST', f'/sessions/{session_id}/create-memory', json=options)
        return Memory(**response.data)
    
    def execute_memory(self, memory_id: str, **options) -> Dict[str, Any]:
        """Execute memory"""
        response = self._make_request('POST', f'/memories/{memory_id}/execute', json=options)
        return response.data
    
    def get_quality_metrics(self) -> Dict[str, Any]:
        """Get memory quality metrics"""
        response = self._make_request('GET', '/quality-metrics')
        return response.data
    
    # Export API
    def create_export(self, **options) -> Dict[str, Any]:
        """Create data export"""
        response = self._make_request('POST', '/export', json=options)
        return response.data
    
    def list_exports(self) -> List[Dict[str, Any]]:
        """List available exports"""
        response = self._make_request('GET', '/export/list')
        return response.data
    
    def download_export(self, filename: str) -> bytes:
        """Download export file"""
        url = f"{self.config.base_url}/api/export/download/{filename}"
        response = self.session.get(url, timeout=self.config.timeout)
        response.raise_for_status()
        return response.content
    
    def delete_export(self, filename: str) -> None:
        """Delete export file"""
        self._make_request('DELETE', f'/export/{filename}')
    
    # Analysis API
    def analyze_with_kura(self, **options) -> Dict[str, Any]:
        """Analyze sessions with Kura"""
        response = self._make_request('POST', '/sessions/analyze-with-kura', json=options)
        return response.data
    
    def analyze_with_clio(self, **options) -> Dict[str, Any]:
        """Analyze sessions with Clio"""
        response = self._make_request('POST', '/sessions/analyze-with-clio', json=options)
        return response.data
    
    def get_procedure_patterns(self) -> List[Dict[str, Any]]:
        """Get procedure patterns"""
        response = self._make_request('GET', '/procedures/patterns')
        return response.data
    
    def execute_procedure(self, **options) -> Dict[str, Any]:
        """Execute procedure"""
        response = self._make_request('POST', '/procedures/execute', json=options)
        return response.data
    
    # Privacy API
    def analyze_privacy(self, config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Analyze privacy settings"""
        response = self._make_request('POST', '/privacy/analyze', json={'config': config})
        return response.data
    
    def update_privacy_config(self, config: Dict[str, Any]) -> None:
        """Update privacy configuration"""
        self._make_request('POST', '/privacy/config', json=config)
    
    # Health check
    def health_check(self) -> bool:
        """Check API health"""
        try:
            response = self._make_request('GET', '/health')
            return response.data.get('status') == 'ok'
        except:
            return False
    
    # Real-time monitoring (WebSocket)
    async def connect_websocket(self) -> websockets.WebSocketServerProtocol:
        """Connect to WebSocket for real-time updates"""
        ws_url = self.config.base_url.replace('http', 'ws') + '/socket.io/'
        return await websockets.connect(ws_url)
    
    async def listen_for_updates(self, callback):
        """Listen for real-time updates"""
        websocket = await self.connect_websocket()
        try:
            async for message in websocket:
                data = json.loads(message)
                await callback(data)
        finally:
            await websocket.close()


# Convenience function for quick setup
def create_client(base_url: str, api_key: Optional[str] = None) -> CursorTelemetryAPI:
    """Create a Cursor Telemetry API client with minimal configuration"""
    config = CursorTelemetryConfig(base_url=base_url, api_key=api_key)
    return CursorTelemetryAPI(config)
