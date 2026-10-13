"""
Custom exception hierarchy for the Building Data Ingestion Pipeline.
Enables fine-grained, traceable error handling across multi-source ingestion.
"""

class BuildingDataError(Exception):
    """Base exception for all building data processing errors."""
    pass


class CoordinateSystemError(BuildingDataError):
    """Raised when coordinates are invalid, out of bounds, or CRS reprojection fails."""
    pass


class DataSourceUnavailableError(BuildingDataError):
    """Raised when an external data source cannot be reached or returns an unrecoverable failure."""
    pass


class OverpassAPIError(DataSourceUnavailableError):
    """Raised when OpenStreetMap Overpass API fails after exhausting retries."""
    pass


class OverpassTimeoutError(OverpassAPIError):
    """Raised when OpenStreetMap Overpass API times out."""
    pass


class InvalidGeometryError(BuildingDataError):
    """Raised when a building polygon cannot be parsed or repaired."""
    pass


class PipelineExecutionError(BuildingDataError):
    """Raised when the orchestration pipeline encounters an unrecoverable failure."""
    pass
