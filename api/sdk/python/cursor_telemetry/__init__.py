"""
Cursor Telemetry SDK
Official Python SDK for Cursor Telemetry API
"""

from .client import CursorTelemetryAPI
from .models import Session, Project, Event, Analytics, Memory, APIResponse
from .exceptions import CursorTelemetryError, APIError, ConnectionError, AuthenticationError

__version__ = "1.0.0"
__author__ = "Cursor Telemetry Team"

__all__ = [
    "CursorTelemetryAPI",
    "Session",
    "Project", 
    "Event",
    "Analytics",
    "Memory",
    "APIResponse",
    "CursorTelemetryError",
    "APIError",
    "ConnectionError",
    "AuthenticationError",
]
