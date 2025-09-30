"""
Custom exceptions for Cursor Telemetry SDK
"""


class CursorTelemetryError(Exception):
    """Base exception for Cursor Telemetry SDK"""
    pass


class APIError(CursorTelemetryError):
    """API-related errors"""
    def __init__(self, message: str, status_code: int = None):
        super().__init__(message)
        self.status_code = status_code


class ConnectionError(CursorTelemetryError):
    """Connection-related errors"""
    pass


class AuthenticationError(CursorTelemetryError):
    """Authentication-related errors"""
    pass


class ValidationError(CursorTelemetryError):
    """Data validation errors"""
    pass


class RateLimitError(CursorTelemetryError):
    """Rate limiting errors"""
    def __init__(self, message: str, retry_after: int = None):
        super().__init__(message)
        self.retry_after = retry_after


class NotFoundError(CursorTelemetryError):
    """Resource not found errors"""
    pass


class ServerError(CursorTelemetryError):
    """Server-side errors"""
    pass
