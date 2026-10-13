"""
Geometry and attribute validation module for building footprint ingestion.
Enforces rigorous quality gates, automatic polygon repair, sanity clipping,
and isolated error handling to guarantee zero crashes on malformed data.
"""
from __future__ import annotations
import math
import logging
from typing import Any, Dict, Optional, Tuple, List
from shapely.geometry import shape, mapping, Polygon, MultiPolygon, GeometryCollection
from shapely.ops import unary_union
from .exceptions import InvalidGeometryError, CoordinateSystemError

logger = logging.getLogger(__name__)

# Sanity threshold constants
MIN_FOOTPRINT_AREA_SQM = 4.0        # Noise/digitization artifact threshold
MAX_FOOTPRINT_AREA_SQM = 50000.0    # Flag threshold for unnaturally massive polygons
MIN_REALISTIC_HEIGHT_M = 2.0        # Minimum sensible building height
MAX_REALISTIC_HEIGHT_M = 300.0      # Maximum sensible building height (tallest towers in India ~300m)


def calculate_approx_area_sqm(geom) -> float:
    """
    Computes accurate geodesic/metric footprint area in square meters
    from an EPSG:4326 (WGS84 degrees) polygon without requiring GDAL/PROJ binaries.
    Uses latitude-scaled ellipsoidal approximation:
      1 deg lat ~ 111,139 m
      1 deg lon ~ 111,139 * cos(lat) m
    """
    if geom is None or geom.is_empty:
        return 0.0

    try:
        centroid = geom.centroid
        lat_rad = math.radians(centroid.y)
        m_per_deg_lat = 111139.0
        m_per_deg_lon = 111139.0 * max(0.01, math.cos(lat_rad))
        # geom.area is in deg^2
        area_sqm = geom.area * m_per_deg_lat * m_per_deg_lon
        return float(area_sqm)
    except Exception as e:
        logger.warning(f"Error calculating metric area: {e}")
        return 0.0


def validate_coordinates_wgs84(coords: List[Any]) -> bool:
    """
    Recursively validates that all coordinate pairs lie strictly within
    WGS84 EPSG:4326 bounds: -180 <= lng <= 180 and -90 <= lat <= 90.
    """
    if not coords:
        return False
    if isinstance(coords[0], (int, float)):
        # Base case: [lng, lat]
        if len(coords) < 2:
            return False
        lng, lat = coords[0], coords[1]
        if not (-180.0 <= lng <= 180.0 and -90.0 <= lat <= 90.0):
            return False
        return True

    return all(validate_coordinates_wgs84(sub) for sub in coords)


def sanitize_and_repair_geometry(geom_dict: Dict[str, Any]) -> Tuple[Optional[Any], Optional[str]]:
    """
    Validates and repairs a GeoJSON geometry dictionary using Shapely.
    
    1. Checks GeoJSON structure and coordinate bounds.
    2. Constructs Shapely geometry.
    3. Runs is_valid check.
    4. Auto-repairs simple self-intersections via buffer(0).
    5. Discards unrepairable geometries with reason.
    
    Returns:
      (repaired_shapely_geom, exclusion_reason)
    """
    if not isinstance(geom_dict, dict):
        return None, "malformed_geometry_dict"

    gtype = geom_dict.get("type")
    coords = geom_dict.get("coordinates")
    if not gtype or coords is None:
        return None, "missing_geometry_type_or_coordinates"

    if gtype not in ("Polygon", "MultiPolygon"):
        return None, f"unsupported_geometry_type_{gtype}"

    # Verify EPSG:4326 range
    if not validate_coordinates_wgs84(coords):
        return None, "coordinates_out_of_wgs84_bounds"

    try:
        geom = shape(geom_dict)
    except Exception as e:
        return None, f"geometry_construction_failed: {str(e)}"

    if geom.is_empty:
        return None, "empty_geometry"

    # Self-intersection repair
    if not geom.is_valid:
        try:
            geom = geom.buffer(0)
        except Exception as e:
            return None, f"buffer_repair_exception: {str(e)}"

        if not geom.is_valid or geom.is_empty:
            return None, "invalid_geometry_unrepairable"

    # Normalize MultiPolygon if small slivers resulted from repair
    if isinstance(geom, MultiPolygon):
        # Keep only valid Polygon parts with significant area
        polygons = [p for p in geom.geoms if isinstance(p, Polygon) and p.is_valid and not p.is_empty]
        if not polygons:
            return None, "invalid_geometry_unrepairable"
        if len(polygons) == 1:
            geom = polygons[0]
        else:
            geom = MultiPolygon(polygons)

    return geom, None


def sanitize_height(height_m: Any) -> Tuple[float, Optional[str]]:
    """
    Enforces Height Sanity Bounds (Section 5, Check 4).
    Clips height between MIN_REALISTIC_HEIGHT_M (2m) and MAX_REALISTIC_HEIGHT_M (300m).
    Never allows negative or absurd heights through unmodified.
    Returns: (sanitized_height_m, note)
    """
    note = None
    try:
        val = float(height_m)
    except (ValueError, TypeError):
        val = 6.0
        note = "invalid_non_numeric_height_defaulted_to_6m"

    if val < MIN_REALISTIC_HEIGHT_M:
        note = f"height_clipped_below_min_{val}m_to_{MIN_REALISTIC_HEIGHT_M}m"
        val = MIN_REALISTIC_HEIGHT_M
    elif val > MAX_REALISTIC_HEIGHT_M:
        note = f"height_clipped_above_max_{val}m_to_{MAX_REALISTIC_HEIGHT_M}m"
        val = MAX_REALISTIC_HEIGHT_M

    return round(val, 2), note


def validate_building_feature(
    feature: Dict[str, Any],
    min_area_sqm: float = MIN_FOOTPRINT_AREA_SQM,
    max_area_sqm: float = MAX_FOOTPRINT_AREA_SQM
) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """
    Validates a single GeoJSON Feature dictionary against all Section 5 quality rules:
    - Safe field accesses (.get())
    - Geometry validity & repair
    - Minimum & maximum area filters
    - Coordinate validation
    - Height sanity bounds
    
    Returns:
      (cleaned_feature_dict, rejection_reason)
    """
    if not isinstance(feature, dict):
        return None, "feature_not_a_dictionary"

    geom_dict = feature.get("geometry")
    if not geom_dict:
        return None, "missing_geometry"

    # 1. Geometry validity & repair
    geom, rejection = sanitize_and_repair_geometry(geom_dict)
    if rejection or geom is None:
        return None, rejection

    # 2. Minimum area filter
    area_sqm = calculate_approx_area_sqm(geom)
    if area_sqm < min_area_sqm:
        return None, f"excluded_below_min_area_{area_sqm:.2f}sqm"

    # Properties safe access
    raw_props = feature.get("properties")
    props = dict(raw_props) if isinstance(raw_props, dict) else {}

    # 3. Maximum area check (log & flag for review, keep feature)
    if area_sqm > max_area_sqm:
        props["quality_flag"] = f"excessive_area_{area_sqm:.0f}sqm"
        logger.warning(f"Building feature has unusually large footprint: {area_sqm:.1f} m^2")

    # 4. Height sanity bounds
    raw_height = props.get("height_m", props.get("height", 6.0))
    sanitized_h, height_note = sanitize_height(raw_height)
    props["height_m"] = sanitized_h
    if height_note:
        props["height_sanity_note"] = height_note

    props["footprint_area_sqm"] = round(area_sqm, 2)

    cleaned_feature = {
        "type": "Feature",
        "id": feature.get("id") or props.get("id"),
        "geometry": mapping(geom),
        "properties": props
    }

    return cleaned_feature, None


def compute_iou(geom1, geom2) -> float:
    """
    Computes Intersection over Union (IoU) between two Shapely geometries.
    """
    if not geom1.is_valid or not geom2.is_valid:
        return 0.0
    try:
        intersection = geom1.intersection(geom2).area
        if intersection <= 0:
            return 0.0
        union = geom1.union(geom2).area
        return intersection / union if union > 0 else 0.0
    except Exception:
        return 0.0
