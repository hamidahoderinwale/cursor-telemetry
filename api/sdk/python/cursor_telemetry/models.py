"""
Data models for Cursor Telemetry API
Pydantic models for type safety and validation
"""

from typing import Dict, List, Optional, Any, Union
from datetime import datetime
from pydantic import BaseModel, Field


class Event(BaseModel):
    """Development event model"""
    id: str = Field(..., description="Unique event identifier")
    type: str = Field(..., description="Event type")
    timestamp: str = Field(..., description="Event timestamp")
    data: Dict[str, Any] = Field(default_factory=dict, description="Event data")


class Session(BaseModel):
    """Development session model"""
    id: str = Field(..., description="Unique session identifier")
    name: str = Field(..., description="Session name")
    start_time: str = Field(..., description="Session start time")
    end_time: Optional[str] = Field(None, description="Session end time")
    duration: Optional[int] = Field(None, description="Session duration in seconds")
    project_path: Optional[str] = Field(None, description="Project path")
    files: List[str] = Field(default_factory=list, description="Files in session")
    events: List[Event] = Field(default_factory=list, description="Session events")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Session metadata")


class Project(BaseModel):
    """Project model"""
    id: str = Field(..., description="Unique project identifier")
    name: str = Field(..., description="Project name")
    path: str = Field(..., description="Project path")
    sessions: List[Session] = Field(default_factory=list, description="Project sessions")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Project metadata")


class Analytics(BaseModel):
    """Analytics data model"""
    total_sessions: int = Field(..., description="Total number of sessions")
    total_duration: int = Field(..., description="Total duration in seconds")
    average_session_length: float = Field(..., description="Average session length")
    most_active_files: List[Dict[str, Union[str, int]]] = Field(
        default_factory=list, 
        description="Most active files"
    )
    session_trends: List[Dict[str, Union[str, int]]] = Field(
        default_factory=list, 
        description="Session trends over time"
    )


class Memory(BaseModel):
    """Memory model for generated artifacts"""
    id: str = Field(..., description="Unique memory identifier")
    session_id: str = Field(..., description="Source session ID")
    name: str = Field(..., description="Memory name")
    content: str = Field(..., description="Memory content")
    type: str = Field(..., description="Memory type (notebook, session-file, integration-package)")
    created_at: str = Field(..., description="Creation timestamp")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Memory metadata")


class APIResponse(BaseModel):
    """Standard API response model"""
    success: bool = Field(..., description="Request success status")
    data: Optional[Any] = Field(None, description="Response data")
    error: Optional[str] = Field(None, description="Error message if failed")
    timestamp: str = Field(..., description="Response timestamp")


class CursorTelemetryConfig(BaseModel):
    """Client configuration model"""
    base_url: str = Field(..., description="API base URL")
    api_key: Optional[str] = Field(None, description="API key for authentication")
    timeout: int = Field(30, description="Request timeout in seconds")
    retries: int = Field(3, description="Number of retries for failed requests")


class WebSocketMessage(BaseModel):
    """WebSocket message model"""
    type: str = Field(..., description="Message type")
    data: Dict[str, Any] = Field(default_factory=dict, description="Message data")
    timestamp: str = Field(..., description="Message timestamp")


class ExportOptions(BaseModel):
    """Export options model"""
    format: str = Field("json", description="Export format")
    include_sessions: bool = Field(True, description="Include session data")
    include_events: bool = Field(True, description="Include event data")
    include_analytics: bool = Field(True, description="Include analytics data")
    date_range: Optional[Dict[str, str]] = Field(None, description="Date range filter")


class AnalysisOptions(BaseModel):
    """Analysis options model"""
    test_mode: bool = Field(True, description="Run in test mode")
    include_dashboard_data: bool = Field(False, description="Include dashboard data")
    analysis_depth: str = Field("standard", description="Analysis depth level")
    custom_parameters: Dict[str, Any] = Field(default_factory=dict, description="Custom parameters")


class PrivacyConfig(BaseModel):
    """Privacy configuration model"""
    anonymize_filenames: bool = Field(True, description="Anonymize file names")
    anonymize_paths: bool = Field(True, description="Anonymize file paths")
    remove_sensitive_data: bool = Field(True, description="Remove sensitive data")
    retention_days: int = Field(30, description="Data retention period in days")
    custom_rules: Dict[str, Any] = Field(default_factory=dict, description="Custom privacy rules")
