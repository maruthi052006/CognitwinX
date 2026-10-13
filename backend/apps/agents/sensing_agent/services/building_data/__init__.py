"""
Building Data Ingestion Pipeline package.
Provides city-agnostic, multi-source ingestion of building footprints and heights
for urban flood prediction and 3D digital twin visualization.
"""
from .exceptions import (
    BuildingDataError,
    CoordinateSystemError,
    DataSourceUnavailableError,
    OverpassAPIError,
    OverpassTimeoutError,
    InvalidGeometryError,
    PipelineExecutionError,
)
from .height_estimator import (
    estimate_height,
    INDIAN_BUILDING_HEIGHT_HEURISTICS_M,
    parse_numeric_value,
    normalize_building_type,
)
from .validator import (
    validate_building_feature,
    sanitize_and_repair_geometry,
    sanitize_height,
    calculate_approx_area_sqm,
    compute_iou,
    validate_coordinates_wgs84,
)
from .osm_client import OSMBuildingClient
from .microsoft_footprints_client import MicrosoftFootprintsClient
from .bhuvan_lidar_client import BhuvanLiDARClient
from .merger import MultiSourceBuildingMerger
from .pipeline import BuildingIngestionPipeline, IngestionResult

__all__ = [
    "BuildingDataError",
    "CoordinateSystemError",
    "DataSourceUnavailableError",
    "OverpassAPIError",
    "OverpassTimeoutError",
    "InvalidGeometryError",
    "PipelineExecutionError",
    "estimate_height",
    "INDIAN_BUILDING_HEIGHT_HEURISTICS_M",
    "parse_numeric_value",
    "normalize_building_type",
    "validate_building_feature",
    "sanitize_and_repair_geometry",
    "sanitize_height",
    "calculate_approx_area_sqm",
    "compute_iou",
    "validate_coordinates_wgs84",
    "OSMBuildingClient",
    "MicrosoftFootprintsClient",
    "BhuvanLiDARClient",
    "MultiSourceBuildingMerger",
    "BuildingIngestionPipeline",
    "IngestionResult",
]
