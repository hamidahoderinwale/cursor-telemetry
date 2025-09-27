"""
Type definitions for the Cursor Telemetry SDK
"""

from typing import Dict, List, Optional, Any, Union, Literal
from dataclasses import dataclass
from datetime import datetime
from enum import Enum


class MemoryType(Enum):
    """Memory types"""
    NOTEBOOK = "notebook"
    SESSION_FILE = "session-file"
    INTEGRATION_PACKAGE = "integration-package"


class ExportFormat(Enum):
    """Export formats"""
    JSON = "json"
    CSV = "csv"
    XLSX = "xlsx"
    PDF = "pdf"


class SortOrder(Enum):
    """Sort order options"""
    ASC = "asc"
    DESC = "desc"


@dataclass
class CursorTelemetryConfig:
    """Configuration for the Cursor Telemetry API client"""
    base_url: str
    api_key: Optional[str] = None
    timeout: int = 30
    retries: int = 3
    retry_delay: int = 1
    debug: bool = False


@dataclass
class Event:
    """Development event"""
    id: str
    type: str
    timestamp: str
    data: Dict[str, Any]
    source: Optional[str] = None
    file_path: Optional[str] = None
    content: Optional[str] = None


@dataclass
class CellStage:
    """Cell stage information"""
    index: int
    stage: str
    confidence: float
    content: str
    timestamp: str
    source: str
    stage_info: Optional[Dict[str, Any]] = None


@dataclass
class Session:
    """Development session"""
    id: str
    name: str
    start_time: str
    end_time: Optional[str] = None
    duration: Optional[int] = None
    project_path: str = ""
    files: List[str] = None
    events: List[Event] = None
    metadata: Dict[str, Any] = None
    cell_stages: List[CellStage] = None
    intent: Optional[str] = None
    type: Optional[str] = None
    status: Optional[str] = None

    def __post_init__(self):
        if self.files is None:
            self.files = []
        if self.events is None:
            self.events = []
        if self.metadata is None:
            self.metadata = {}
        if self.cell_stages is None:
            self.cell_stages = []


@dataclass
class Project:
    """Project information"""
    id: str
    name: str
    path: str
    sessions: List[Session]
    metadata: Dict[str, Any]
    created_at: str
    updated_at: str


@dataclass
class Command:
    """Executable command"""
    type: str  # 'file_operation', 'notebook_operation', 'system_command'
    action: str
    path: Optional[str] = None
    content: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None


@dataclass
class Memory:
    """Executable memory"""
    id: str
    session_id: str
    name: str
    content: str
    type: str  # 'notebook', 'session-file', 'integration-package'
    created_at: str
    metadata: Dict[str, Any]
    executable: Optional[Dict[str, Any]] = None
    quality: Optional[Dict[str, Any]] = None


@dataclass
class Analytics:
    """Analytics data"""
    total_sessions: int
    total_duration: int
    average_session_length: float
    most_active_files: List[Dict[str, Any]]
    session_trends: List[Dict[str, Any]]
    stage_distribution: Optional[Dict[str, int]] = None
    complexity_metrics: Optional[Dict[str, Any]] = None


@dataclass
class ExportOptions:
    """Export options"""
    format: str  # 'json', 'csv', 'xlsx', 'pdf'
    include_sessions: bool = True
    include_events: bool = True
    include_analytics: bool = True
    include_memories: bool = True
    date_range: Optional[Dict[str, str]] = None
    filters: Optional[Dict[str, Any]] = None


@dataclass
class ExportResult:
    """Export result"""
    filename: str
    download_url: str
    size: int
    created_at: str
    expires_at: str


@dataclass
class ApiResponse:
    """API response wrapper"""
    success: bool
    data: Optional[Any] = None
    error: Optional[str] = None
    timestamp: str = ""
    request_id: Optional[str] = None


@dataclass
class PaginationOptions:
    """Pagination options"""
    limit: Optional[int] = None
    offset: Optional[int] = None
    sort_by: Optional[str] = None
    sort_order: Optional[str] = None


@dataclass
class SearchOptions(PaginationOptions):
    """Search options"""
    query: str
    filters: Optional[Dict[str, Any]] = None
    date_range: Optional[Dict[str, str]] = None


@dataclass
class WebSocketEvent:
    """WebSocket event"""
    type: str
    data: Any
    timestamp: str


@dataclass
class WebSocketConfig:
    """WebSocket configuration"""
    auto_reconnect: bool = True
    reconnect_interval: int = 5000
    max_reconnect_attempts: int = 10
    on_connect: Optional[callable] = None
    on_disconnect: Optional[callable] = None
    on_error: Optional[callable] = None


@dataclass
class NotebookGenerationOptions:
    """Notebook generation options"""
    include_metadata: bool = True
    format: str = "jupyter"  # 'jupyter', 'colab', 'markdown'
    add_cells: bool = True
    include_analysis: bool = False
    template: Optional[str] = None


@dataclass
class MemoryCreationOptions:
    """Memory creation options"""
    name: str
    type: str  # 'notebook', 'session-file', 'integration-package'
    tags: Optional[List[str]] = None
    description: Optional[str] = None
    include_memories: bool = True
    include_ast_analysis: bool = True
    include_kura_analysis: bool = True
    pkl_features: bool = True


@dataclass
class ExecutionContext:
    """Execution context"""
    target_directory: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None
    environment: Optional[Dict[str, str]] = None
    options: Optional[Dict[str, Any]] = None


@dataclass
class ExecutionResult:
    """Execution result"""
    memory_id: str
    executed: str
    commands: List[Command]
    results: List[Any]
    success: bool
    errors: List[Dict[str, Any]]
    duration: Optional[int] = None


# Error classes
class CursorTelemetryError(Exception):
    """Base exception for Cursor Telemetry SDK"""
    
    def __init__(
        self,
        message: str,
        code: Optional[str] = None,
        status_code: Optional[int] = None,
        request_id: Optional[str] = None
    ):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.request_id = request_id


class AuthenticationError(CursorTelemetryError):
    """Authentication error"""
    
    def __init__(self, message: str = "Authentication failed", request_id: Optional[str] = None):
        super().__init__(message, "AUTH_ERROR", 401, request_id)


class RateLimitError(CursorTelemetryError):
    """Rate limit error"""
    
    def __init__(
        self,
        message: str = "Rate limit exceeded",
        retry_after: Optional[int] = None,
        request_id: Optional[str] = None
    ):
        super().__init__(message, "RATE_LIMIT_ERROR", 429, request_id)
        self.retry_after = retry_after


class ValidationError(CursorTelemetryError):
    """Validation error"""
    
    def __init__(self, message: str, request_id: Optional[str] = None):
        super().__init__(message, "VALIDATION_ERROR", 400, request_id)


class NotFoundError(CursorTelemetryError):
    """Not found error"""
    
    def __init__(self, message: str = "Resource not found", request_id: Optional[str] = None):
        super().__init__(message, "NOT_FOUND_ERROR", 404, request_id)


class ServerError(CursorTelemetryError):
    """Server error"""
    
    def __init__(self, message: str = "Internal server error", request_id: Optional[str] = None):
        super().__init__(message, "SERVER_ERROR", 500, request_id)
