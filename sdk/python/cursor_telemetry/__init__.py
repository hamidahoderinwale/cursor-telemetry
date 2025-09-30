"""
Cursor Telemetry SDK for Python

Official Python SDK for the Cursor Telemetry Dashboard API.
"""

__version__ = "1.1.0"
__author__ = "Cursor Telemetry Team"
__email__ = "team@cursor-telemetry.com"

from .client import CursorTelemetryAPI, create_client
from .realtime import RealTimeClient, RealTimeManager, WebSocketEvent
from .types import (
    CursorTelemetryConfig,
    Session,
    Event,
    CellStage,
    Project,
    Memory,
    Command,
    Analytics,
    ExportOptions,
    ExportResult,
    ApiResponse,
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

# Main exports
__all__ = [
    # Main client
    "CursorTelemetryAPI",
    "create_client",
    
    # Real-time components
    "RealTimeClient",
    "RealTimeManager",
    "WebSocketEvent",
    
    # Types
    "CursorTelemetryConfig",
    "Session",
    "Event",
    "CellStage",
    "Project",
    "Memory",
    "Command",
    "Analytics",
    "ExportOptions",
    "ExportResult",
    "ApiResponse",
    "PaginationOptions",
    "SearchOptions",
    "WebSocketEvent",
    "WebSocketConfig",
    "NotebookGenerationOptions",
    "MemoryCreationOptions",
    "ExecutionContext",
    "ExecutionResult",
    
    # Errors
    "CursorTelemetryError",
    "AuthenticationError",
    "RateLimitError",
    "ValidationError",
    "NotFoundError",
    "ServerError",
]

# Convenience function for quick setup
def quick_start(base_url: str = "http://localhost:3000", api_key: str = None):
    """
    Quick start function to create a Cursor Telemetry API client.
    
    Args:
        base_url: The base URL of the Cursor Telemetry API
        api_key: Optional API key for authentication
        
    Returns:
        CursorTelemetryAPI: Configured API client
        
    Example:
        >>> import cursor_telemetry
        >>> api = cursor_telemetry.quick_start()
        >>> sessions = api.sessions.get_all()
    """
    return create_client(base_url=base_url, api_key=api_key)
