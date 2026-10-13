"""
Height estimation module tuned for Indian urban typology.
Provides robust parsing, heuristic mapping, and confidence attribution.
"""
from __future__ import annotations
import re
import logging
from typing import Any, Tuple, Optional

logger = logging.getLogger(__name__)

# Heuristic height lookup in meters calibrated for Indian municipal urban contexts
INDIAN_BUILDING_HEIGHT_HEURISTICS_M = {
    "house": 4.5,               # Typical single/double-storey Indian residential house
    "residential": 6.0,         # General residential structure (2 floors)
    "apartments": 15.0,         # Indian apartment complexes commonly 4-6 floors
    "apartment": 15.0,
    "bungalow": 4.5,
    "commercial": 9.0,          # Mixed commercial / shopping complex
    "retail": 6.0,
    "shop": 4.5,
    "hospital": 12.0,           # Community hospital / clinic complex
    "clinic": 6.0,
    "school": 9.0,              # Primary / secondary school building (2-3 floors)
    "college": 12.0,            # University / college academic block
    "university": 15.0,
    "industrial": 8.0,          # Fabrication shed / plant
    "warehouse": 7.0,
    "government": 10.0,         # Municipal / public administration office
    "civic": 10.0,
    "public": 10.0,
    "hut": 3.0,                 # Informal settlement / kutcha structures
    "slum": 3.0,
    "shed": 3.5,
    "temple": 6.0,              # Traditional Indian place of worship / mandir / mosque / church
    "mosque": 7.0,
    "church": 9.0,
    "hotel": 18.0,              # Hospitality high-rise / lodge
    "office": 15.0,             # Tech park / commercial office building
    "dormitory": 12.0,
    "default_unknown": 6.0,     # Conservative fallback if building type tag is missing entirely
}

# Synonyms and alias normalization map
TYPE_ALIASES = {
    "flats": "apartments",
    "flat": "apartments",
    "residential_building": "residential",
    "detached": "house",
    "semidetached_house": "house",
    "terrace": "house",
    "retail_store": "retail",
    "mall": "commercial",
    "supermarket": "retail",
    "manufacture": "industrial",
    "factory": "industrial",
    "storage": "warehouse",
    "shrine": "temple",
    "place_of_worship": "temple",
}


def parse_numeric_value(val: Any) -> Optional[float]:
    """
    Safely parses numeric values from raw strings or numbers.
    Handles '12 m', '15.5m', '4 floors', '2;3', 'abc', -50, None.
    Returns None if value cannot be parsed or is non-positive.
    """
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val) if val > 0 else None
    
    val_str = str(val).strip().lower()
    if not val_str:
        return None

    # Handle semi-colon separated lists (take the first or max) e.g. "3;4"
    if ";" in val_str:
        val_str = val_str.split(";")[0].strip()

    # Extract first floating or integer number
    match = re.search(r"[-+]?\d*\.?\d+", val_str)
    if not match:
        return None

    try:
        parsed = float(match.group())
        return parsed if parsed > 0 else None
    except (ValueError, TypeError):
        return None


def normalize_building_type(raw_type: Any) -> str:
    """
    Normalizes building type strings (e.g., 'yes', 'Apartments', 'Commercial;Shop').
    """
    if not raw_type or not isinstance(raw_type, str):
        return "default_unknown"

    cleaned = raw_type.strip().lower().replace("-", "_").replace(" ", "_")
    if ";" in cleaned:
        cleaned = cleaned.split(";")[0].strip()

    # In OSM, building=yes is very common when the type is unknown
    if cleaned in ("yes", "true", "1", "building", "unclassified"):
        return "default_unknown"

    cleaned = TYPE_ALIASES.get(cleaned, cleaned)
    if cleaned in INDIAN_BUILDING_HEIGHT_HEURISTICS_M:
        return cleaned

    return "default_unknown"


def estimate_height(
    building_type: Any = None,
    levels: Any = None,
    explicit_height_m: Any = None
) -> Tuple[float, str]:
    """
    Returns (height_m, confidence_source) where confidence_source is one of:
    - 'explicit_height' (highest confidence, measured/surveyed tag)
    - 'levels_tag'     (floor count * 3.0m standard storey height)
    - 'type_heuristic' (heuristic based on Indian urban typology)
    - 'default_fallback' (generic fallback when no attributes are present)
    """
    parsed_height = parse_numeric_value(explicit_height_m)
    if parsed_height is not None and parsed_height > 0:
        return round(parsed_height, 2), "explicit_height"

    parsed_levels = parse_numeric_value(levels)
    if parsed_levels is not None and parsed_levels > 0:
        # Standard storey height in Indian building code is ~3.0 meters
        calculated_h = parsed_levels * 3.0
        return round(calculated_h, 2), "levels_tag"

    norm_type = normalize_building_type(building_type)
    if norm_type in INDIAN_BUILDING_HEIGHT_HEURISTICS_M and norm_type != "default_unknown":
        return round(INDIAN_BUILDING_HEIGHT_HEURISTICS_M[norm_type], 2), "type_heuristic"

    return round(INDIAN_BUILDING_HEIGHT_HEURISTICS_M["default_unknown"], 2), "default_fallback"
