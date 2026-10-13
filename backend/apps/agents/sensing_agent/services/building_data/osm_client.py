"""
OpenStreetMap Overpass API client for building footprint ingestion.
Features:
- Generic bounding box queries (city-agnostic)
- Mirror failover and exponential backoff retry (max 3 attempts)
- Safe tag extraction and height inference
- Spatial chunking/sub-tiling for large geographic zones
"""
from __future__ import annotations
import time
import math
import logging
import requests
from typing import Any, Dict, List, Optional, Tuple
from shapely.geometry import Polygon, MultiPolygon, mapping
from .exceptions import OverpassAPIError, OverpassTimeoutError
from .height_estimator import estimate_height

logger = logging.getLogger(__name__)

# Public Overpass API mirrors for high availability and failover
OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]

DEFAULT_TIMEOUT_SEC = 25
MAX_RETRIES = 3


def format_bbox(bbox: Tuple[float, float, float, float]) -> Tuple[float, float, float, float]:
    """
    Standardizes bbox into (south, west, north, east).
    Input can be (min_lat, min_lon, max_lat, max_lon).
    """
    south, west, north, east = bbox
    # Ensure min/max ordering
    s = min(south, north)
    n = max(south, north)
    w = min(west, east)
    e = max(west, east)
    return (round(s, 6), round(w, 6), round(n, 6), round(e, 6))


def build_overpass_query(south: float, west: float, north: float, east: float, timeout_sec: int = DEFAULT_TIMEOUT_SEC) -> str:
    """
    Constructs an optimized Overpass QL query for buildings inside the bbox.
    """
    return f"""
    [out:json][timeout:{timeout_sec}];
    (
      way["building"]({south},{west},{north},{east});
      relation["building"]({south},{west},{north},{east});
    );
    out body;
    >;
    out skel qt;
    """


class OSMBuildingClient:
    """
    Client for querying, parsing, and standardizing OpenStreetMap building footprints.
    """
    def __init__(
        self,
        endpoints: Optional[List[str]] = None,
        timeout_sec: int = DEFAULT_TIMEOUT_SEC,
        max_retries: int = MAX_RETRIES,
        user_agent: str = "CognitwinX-DisasterManagement-DigitalTwin/1.0"
    ):
        self.endpoints = endpoints or OVERPASS_ENDPOINTS
        self.timeout_sec = timeout_sec
        self.max_retries = max_retries
        self.headers = {
            "User-Agent": user_agent,
            "Accept": "application/json"
        }

    def fetch_raw_osm(self, south: float, west: float, north: float, east: float) -> Dict[str, Any]:
        """
        Executes Overpass API query with exponential backoff and endpoint failover.
        """
        query = build_overpass_query(south, west, north, east, self.timeout_sec)
        last_error = None

        for attempt in range(self.max_retries):
            # Select endpoint round-robin or upon failure
            endpoint = self.endpoints[attempt % len(self.endpoints)]
            try:
                logger.info(f"Querying Overpass API (attempt {attempt+1}/{self.max_retries}) via {endpoint}...")
                response = requests.post(
                    endpoint,
                    data={"data": query},
                    headers=self.headers,
                    timeout=self.timeout_sec
                )

                if response.status_code == 200:
                    data = response.json()
                    return data
                elif response.status_code in (429, 504):
                    # Rate limit or gateway timeout
                    wait_time = (2 ** attempt) * 1.5
                    logger.warning(f"Overpass returned status {response.status_code}. Backing off for {wait_time:.1f}s...")
                    time.sleep(wait_time)
                    last_error = OverpassTimeoutError(f"HTTP {response.status_code} from {endpoint}")
                else:
                    logger.warning(f"Overpass returned unexpected status {response.status_code}: {response.text[:200]}")
                    last_error = OverpassAPIError(f"HTTP {response.status_code} from {endpoint}")

            except requests.exceptions.Timeout as e:
                logger.warning(f"Timeout querying Overpass on {endpoint}: {e}")
                last_error = OverpassTimeoutError(str(e))
                time.sleep((2 ** attempt))
            except requests.exceptions.RequestException as e:
                logger.warning(f"Request exception on {endpoint}: {e}")
                last_error = OverpassAPIError(str(e))
                time.sleep((2 ** attempt))

        raise last_error or OverpassAPIError("Failed to fetch from Overpass API after max retries")

    def parse_osm_response(self, osm_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Transforms raw Overpass JSON elements into standardized GeoJSON Feature dictionaries.
        """
        elements = osm_data.get("elements", [])
        if not elements:
            return []

        # Index nodes by id: {node_id: (lon, lat)}
        nodes: Dict[int, Tuple[float, float]] = {}
        ways: List[Dict[str, Any]] = []

        for elem in elements:
            etype = elem.get("type")
            if etype == "node":
                nid = elem.get("id")
                lat = elem.get("lat")
                lon = elem.get("lon")
                if nid is not None and lat is not None and lon is not None:
                    nodes[nid] = (float(lon), float(lat))
            elif etype == "way":
                ways.append(elem)

        features: List[Dict[str, Any]] = []

        for way in ways:
            tags = way.get("tags", {})
            node_ids = way.get("nodes", [])

            # Must have at least 3 distinct vertices to form a polygon
            if len(node_ids) < 3:
                continue

            coords = []
            for nid in node_ids:
                if nid in nodes:
                    coords.append(nodes[nid])

            if len(coords) < 3:
                continue

            # Ensure polygon ring is closed
            if coords[0] != coords[-1]:
                coords.append(coords[0])

            try:
                poly = Polygon(coords)
                if not poly.is_valid:
                    poly = poly.buffer(0)
                if poly.is_empty:
                    continue
            except Exception:
                continue

            # Tag extraction
            building_tag = tags.get("building", "yes")
            name = tags.get("name", "")
            levels_tag = tags.get("building:levels")
            height_tag = tags.get("height")

            height_m, confidence_source = estimate_height(
                building_type=building_tag,
                levels=levels_tag,
                explicit_height_m=height_tag
            )

            feature = {
                "type": "Feature",
                "id": f"osm_{way.get('id')}",
                "geometry": mapping(poly),
                "properties": {
                    "id": f"osm_{way.get('id')}",
                    "name": name,
                    "building_type": building_tag,
                    "height_m": height_m,
                    "confidence_source": confidence_source,
                    "raw_levels": levels_tag,
                    "raw_height": height_tag,
                    "data_provenance": ["osm"],
                    "source": "OpenStreetMap"
                }
            }
            features.append(feature)

        return features

    def fetch_footprints(
        self,
        bbox: Tuple[float, float, float, float],
        max_area_split_deg: float = 0.05
    ) -> List[Dict[str, Any]]:
        """
        Fetches and parses building footprints for the given bounding box.
        If bbox is larger than max_area_split_deg in lat or lon, subdivides into a grid
        of smaller sub-tiles to avoid Overpass timeouts.
        """
        s, w, n, e = format_bbox(bbox)
        lat_span = n - s
        lon_span = e - w

        # Check if tiling is needed
        if lat_span > max_area_split_deg or lon_span > max_area_split_deg:
            n_lat_tiles = max(1, math.ceil(lat_span / max_area_split_deg))
            n_lon_tiles = max(1, math.ceil(lon_span / max_area_split_deg))
            logger.info(f"Subdividing large bbox into {n_lat_tiles}x{n_lon_tiles} tiles for Overpass ingestion...")

            lat_step = lat_span / n_lat_tiles
            lon_step = lon_span / n_lon_tiles
            all_features: List[Dict[str, Any]] = []
            seen_ids = set()

            for i in range(n_lat_tiles):
                for j in range(n_lon_tiles):
                    tile_s = s + i * lat_step
                    tile_n = min(n, tile_s + lat_step)
                    tile_w = w + j * lon_step
                    tile_e = min(e, tile_w + lon_step)

                    try:
                        raw_data = self.fetch_raw_osm(tile_s, tile_w, tile_n, tile_e)
                        tile_features = self.parse_osm_response(raw_data)
                        for feat in tile_features:
                            fid = feat.get("id")
                            if fid not in seen_ids:
                                seen_ids.add(fid)
                                all_features.append(feat)
                    except Exception as err:
                        logger.error(f"Tile ({tile_s},{tile_w}) fetch failed: {err}")

            return all_features

        # Single bbox query
        raw_data = self.fetch_raw_osm(s, w, n, e)
        return self.parse_osm_response(raw_data)
