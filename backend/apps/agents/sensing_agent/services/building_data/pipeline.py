"""
Building Data Ingestion Pipeline.
City-agnostic, production-grade orchestrator that fetches, validates,
cross-checks, and prepares building footprints and heights for ANY urban zone in India.
"""
from __future__ import annotations
import logging
from dataclasses import dataclass, field, asdict
from datetime import timedelta
from typing import Any, Dict, List, Optional, Tuple, Union

from django.utils import timezone
from .exceptions import CoordinateSystemError, PipelineExecutionError
from .osm_client import OSMBuildingClient, format_bbox
from .microsoft_footprints_client import MicrosoftFootprintsClient
from .bhuvan_lidar_client import BhuvanLiDARClient
from .merger import MultiSourceBuildingMerger
from .validator import (
    validate_building_feature,
    validate_coordinates_wgs84,
    MIN_FOOTPRINT_AREA_SQM,
    MAX_FOOTPRINT_AREA_SQM,
)

logger = logging.getLogger(__name__)

DEFAULT_CACHE_TTL_DAYS = 60


@dataclass
class IngestionResult:
    total_fetched: int = 0
    valid_buildings: int = 0
    excluded_invalid_geometry: int = 0
    excluded_area_outlier: int = 0
    height_source_breakdown: Dict[str, int] = field(
        default_factory=lambda: {
            "explicit_height": 0,
            "levels_tag": 0,
            "type_heuristic": 0,
            "default_fallback": 0,
            "bhuvan_lidar_dsm": 0,
        }
    )
    processing_errors: List[Dict[str, Any]] = field(default_factory=list)
    data_sources_used: List[str] = field(default_factory=list)
    merge_telemetry: Dict[str, Any] = field(default_factory=dict)
    cached_response: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class BuildingIngestionPipeline:
    """
    Production-grade pipeline orchestrating multi-source building footprint ingestion.
    """
    def __init__(
        self,
        osm_client: Optional[OSMBuildingClient] = None,
        ms_client: Optional[MicrosoftFootprintsClient] = None,
        bhuvan_client: Optional[BhuvanLiDARClient] = None,
        merger: Optional[MultiSourceBuildingMerger] = None,
        cache_ttl_days: int = DEFAULT_CACHE_TTL_DAYS,
    ):
        self.osm_client = osm_client or OSMBuildingClient()
        self.ms_client = ms_client or MicrosoftFootprintsClient()
        self.bhuvan_client = bhuvan_client or BhuvanLiDARClient()
        self.merger = merger or MultiSourceBuildingMerger()
        self.cache_ttl_days = cache_ttl_days

    def run(
        self,
        bbox: Tuple[float, float, float, float],
        zone: Any = None,
        force_refresh: bool = False,
    ) -> Tuple[Dict[str, Any], IngestionResult]:
        """
        Executes the full fetch -> merge -> enhance -> validate -> output pipeline.
        
        Parameters:
          bbox: (south, west, north, east) or (min_lat, min_lon, max_lat, max_lon) in WGS84
          zone: Optional CityZone model instance for database caching
          force_refresh: If True, bypasses database cache and re-queries external sources
          
        Returns:
          (geojson_feature_collection, IngestionResult)
        """
        result = IngestionResult()
        south, west, north, east = format_bbox(bbox)

        # 1. Coordinate System Consistency check (Section 5, Check 5)
        if not (-90.0 <= south <= 90.0 and -90.0 <= north <= 90.0 and
                -180.0 <= west <= 180.0 and -180.0 <= east <= 180.0):
            raise CoordinateSystemError(
                f"Coordinates out of WGS84 EPSG:4326 range: south={south}, west={west}, north={north}, east={east}"
            )

        # 2. Database caching check (Section 6)
        if zone and not force_refresh:
            last_updated = getattr(zone, "building_data_last_updated", None)
            existing_geojson = getattr(zone, "building_footprints_geojson", None)
            if (
                last_updated
                and timezone.now() - last_updated < timedelta(days=self.cache_ttl_days)
                and existing_geojson
                and isinstance(existing_geojson, dict)
                and existing_geojson.get("features")
            ):
                logger.info(f"Using cached building footprints for zone '{zone.name}' (age < {self.cache_ttl_days} days).")
                cached_report = getattr(zone, "building_data_quality_report", {}) or {}
                result.cached_response = True
                result.valid_buildings = len(existing_geojson.get("features", []))
                result.total_fetched = cached_report.get("total_fetched", result.valid_buildings)
                result.data_sources_used = cached_report.get("data_sources_used", ["cached_database"])
                result.height_source_breakdown = cached_report.get("height_source_breakdown", {})
                return existing_geojson, result

        # 3. Step 1: Query OSM
        osm_features: List[Dict[str, Any]] = []
        try:
            osm_features = self.osm_client.fetch_footprints((south, west, north, east))
            logger.info(f"Fetched {len(osm_features)} raw building features from OpenStreetMap.")
        except Exception as e:
            logger.warning(f"OSM fetch failed or timed out: {e}. Gracefully falling back to Microsoft footprints.")
            result.processing_errors.append({
                "stage": "osm_fetch",
                "error": str(e)
            })

        # 4. Step 2: Query Microsoft Global ML Building Footprints
        ms_features: List[Dict[str, Any]] = []
        try:
            ms_features = self.ms_client.fetch_footprints((south, west, north, east))
            logger.info(f"Fetched {len(ms_features)} building features from Microsoft ML Footprints.")
        except Exception as e:
            logger.error(f"Microsoft Footprints fetch failed: {e}")
            result.processing_errors.append({
                "stage": "microsoft_fetch",
                "error": str(e)
            })

        result.total_fetched = len(osm_features) + len(ms_features)

        # 5. Step 3 & 4: Merge & deduplicate
        merged_candidates, sources_used, telemetry = self.merger.merge(
            osm_features=osm_features,
            ms_features=ms_features,
            bbox=(south, west, north, east)
        )
        result.data_sources_used.extend(sources_used)
        result.merge_telemetry = telemetry

        # 6. Step 5: Opportunistic LiDAR / DSM Enhancement
        enhanced_candidates, dsm_count = self.bhuvan_client.enhance_features_with_dsm(
            features=merged_candidates,
            bbox=(south, west, north, east)
        )
        if dsm_count > 0:
            result.data_sources_used.append("bhuvan_lidar_dsm")

        # 7. Sequential Validation & Cleaning with Partial Failure Isolation (Section 5, Check 9)
        valid_features: List[Dict[str, Any]] = []
        for feat in enhanced_candidates:
            fid = feat.get("id", "unknown_feature")
            try:
                cleaned_feat, rejection_reason = validate_building_feature(feat)
                if rejection_reason:
                    if "invalid_geometry" in rejection_reason or "geometry" in rejection_reason:
                        result.excluded_invalid_geometry += 1
                    elif "below_min_area" in rejection_reason:
                        result.excluded_area_outlier += 1
                    else:
                        result.excluded_invalid_geometry += 1
                    
                    logger.debug(f"Excluded building feature {fid}: {rejection_reason}")
                    continue

                if cleaned_feat:
                    valid_features.append(cleaned_feat)
                    conf = cleaned_feat["properties"].get("confidence_source", "default_fallback")
                    result.height_source_breakdown[conf] = result.height_source_breakdown.get(conf, 0) + 1

            except Exception as feat_err:
                # Partial Failure Isolation: One bad feature must NEVER abort the entire zone
                logger.error(f"Unexpected exception processing feature {fid}: {feat_err}. Raw data: {feat}")
                result.processing_errors.append({
                    "feature_id": fid,
                    "error": str(feat_err),
                    "raw_sample": str(feat)[:150]
                })
                continue

        result.valid_buildings = len(valid_features)

        # 8. Assemble GeoJSON FeatureCollection
        feature_collection = {
            "type": "FeatureCollection",
            "bbox": [west, south, east, north],
            "metadata": {
                "generated_at": timezone.now().isoformat(),
                "total_valid_buildings": result.valid_buildings,
                "sources_used": result.data_sources_used,
                "height_breakdown": result.height_source_breakdown,
            },
            "features": valid_features
        }

        # 9. Database Cache Persistence (Section 6)
        if zone:
            try:
                zone.building_footprints_geojson = feature_collection
                zone.building_data_last_updated = timezone.now()
                zone.building_data_quality_report = result.to_dict()
                zone.save(update_fields=[
                    "building_footprints_geojson",
                    "building_data_last_updated",
                    "building_data_quality_report"
                ])
                logger.info(f"Persisted {result.valid_buildings} buildings to zone '{zone.name}' cache.")
            except Exception as db_err:
                logger.warning(f"Could not persist building data to database zone: {db_err}")

        return feature_collection, result
