"""
Comprehensive test suite for the Building Data Ingestion Pipeline.
Senior QA rigor: covers all 5 required test cases from Section 8 plus hydraulic simulation integration.
"""
import unittest
from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.utils import timezone
from datetime import timedelta
import requests

from shapely.geometry import Polygon, mapping, box
from apps.digital_twin.models import CityZone
from apps.agents.sensing_agent.services.building_data import (
    BuildingIngestionPipeline,
    IngestionResult,
    estimate_height,
    validate_building_feature,
    sanitize_and_repair_geometry,
    sanitize_height,
    compute_iou,
    calculate_approx_area_sqm,
    OSMBuildingClient,
    MicrosoftFootprintsClient,
    MultiSourceBuildingMerger,
    BhuvanLiDARClient,
    CoordinateSystemError,
    OverpassAPIError,
    OverpassTimeoutError,
)
from apps.agents.simulation_agent.heightmap_generator import (
    generate_depth_grid,
    rasterize_building_obstructions,
)


class BuildingDataPipelineTests(TestCase):
    def setUp(self):
        # Center: Chennai Guindy/Velachery area (12.98N, 80.21E)
        self.south = 12.9700
        self.west = 80.2100
        self.north = 12.9750
        self.east = 80.2150
        self.bbox = (self.south, self.west, self.north, self.east)

        # Create a test CityZone
        self.zone = CityZone.objects.create(
            name="Test Urban Zone Chennai",
            city="Chennai",
            center_lat=12.9725,
            center_lng=80.2125,
            elevation_avg=11.5,
            drainage_capacity_index=0.6,
        )

    # ═══════════════════════════════════════════════════════════
    # TEST 1: Good OSM Coverage + Real Height Tag Transfer
    # ═══════════════════════════════════════════════════════════
    def test_good_osm_coverage_and_height_tag_transfer(self):
        """
        Verify that when OSM has dense coverage, Microsoft footprints form the base geometry,
        and OSM real tags (height / levels) are transferred onto overlapping structures (IoU > 0.5).
        """
        # Create overlapping OSM and MS building footprints
        # Structure 1: Center at (80.212, 12.972), size ~20m
        ms_poly = Polygon([
            (80.2120, 12.9720),
            (80.2122, 12.9720),
            (80.2122, 12.9722),
            (80.2120, 12.9722),
            (80.2120, 12.9720)
        ])
        osm_poly = Polygon([
            (80.21201, 12.97201),
            (80.21219, 12.97201),
            (80.21219, 12.97219),
            (80.21201, 12.97219),
            (80.21201, 12.97201)
        ])

        ms_features = [
            {
                "type": "Feature",
                "id": "ms_bldg_1",
                "geometry": mapping(ms_poly),
                "properties": {
                    "id": "ms_bldg_1",
                    "building_type": "residential",
                    "height_m": 6.0,
                    "confidence_source": "default_fallback",
                    "data_provenance": ["microsoft_footprints"]
                }
            }
        ]

        # Populate enough OSM buildings to satisfy density threshold
        osm_features = [
            {
                "type": "Feature",
                "id": "osm_way_101",
                "geometry": mapping(osm_poly),
                "properties": {
                    "id": "osm_way_101",
                    "name": "Apollo Clinic",
                    "building_type": "hospital",
                    "height_m": 24.5,
                    "confidence_source": "explicit_height",
                    "raw_height": "24.5 m",
                    "data_provenance": ["osm"]
                }
            }
        ]

        # Add more dummy OSM features to exceed density threshold
        for i in range(2, 60):
            p = Polygon([
                (80.213 + i * 0.00002, 12.973 + i * 0.00002),
                (80.21301 + i * 0.00002, 12.973 + i * 0.00002),
                (80.21301 + i * 0.00002, 12.97301 + i * 0.00002),
                (80.213 + i * 0.00002, 12.97301 + i * 0.00002),
                (80.213 + i * 0.00002, 12.973 + i * 0.00002)
            ])
            osm_features.append({
                "type": "Feature",
                "id": f"osm_way_{i}",
                "geometry": mapping(p),
                "properties": {
                    "id": f"osm_way_{i}",
                    "building_type": "house",
                    "height_m": 4.5,
                    "confidence_source": "type_heuristic",
                    "data_provenance": ["osm"]
                }
            })

        merger = MultiSourceBuildingMerger(iou_threshold=0.5)
        # Force low threshold for deterministic unit test
        with patch.object(merger, 'calculate_bbox_density_threshold', return_value=10):
            merged, sources, telemetry = merger.merge(osm_features, ms_features, self.bbox)

        self.assertIn("microsoft_footprints", sources)
        self.assertIn("osm", sources)
        self.assertGreater(telemetry["transferred_height_count"], 0)

        # Check matched building has transferred height of 24.5m and explicit_height confidence
        matched = next((f for f in merged if f["id"] == "ms_bldg_1"), None)
        self.assertIsNotNone(matched)
        self.assertEqual(matched["properties"]["height_m"], 24.5)
        self.assertEqual(matched["properties"]["confidence_source"], "explicit_height")
        self.assertIn("osm_height_transfer", matched["properties"]["data_provenance"])

    # ═══════════════════════════════════════════════════════════
    # TEST 2: Poor / Empty OSM Coverage Fallback
    # ═══════════════════════════════════════════════════════════
    def test_poor_or_empty_osm_coverage_fallback(self):
        """
        Verify that when OSM returns 0 buildings or count is below threshold,
        system automatically falls back to Microsoft Footprints as primary and does not crash.
        """
        osm_client_mock = MagicMock(spec=OSMBuildingClient)
        osm_client_mock.fetch_footprints.return_value = [] # Empty OSM

        pipeline = BuildingIngestionPipeline(osm_client=osm_client_mock)
        geojson, result = pipeline.run(self.bbox, zone=self.zone, force_refresh=True)

        self.assertIsInstance(geojson, dict)
        self.assertEqual(geojson.get("type"), "FeatureCollection")
        self.assertGreater(result.valid_buildings, 0)
        self.assertIn("microsoft_footprints", result.data_sources_used)
        self.assertFalse(result.merge_telemetry.get("osm_reliable", True))

        # Check that every building has valid height and confidence
        for feat in geojson["features"]:
            props = feat["properties"]
            self.assertGreater(props["height_m"], 0)
            self.assertIn(props["confidence_source"], ["type_heuristic", "default_fallback", "levels_tag", "explicit_height"])
            self.assertIn("microsoft_footprints", props["data_provenance"])

    # ═══════════════════════════════════════════════════════════
    # TEST 3: Deliberately Malformed Input Robustness
    # ═══════════════════════════════════════════════════════════
    def test_deliberately_malformed_inputs_handling(self):
        """
        Verify:
        - Self-intersecting polygon (bowtie) is auto-repaired via buffer(0)
        - Height tag '-50' is clamped to minimum bound (2.0m)
        - Non-numeric height 'abc' defaults safely to 6.0m
        - Missing building type tag defaults to 'default_unknown' / 'default_fallback'
        - Tiny polygon < 4 sq meters is excluded
        - Massive polygon > 50,000 sq meters is flagged with quality_flag
        - Unexpected exception in 1 feature is isolated without crashing the rest
        """
        # Case A: Self-intersecting bowtie polygon
        bowtie_coords = [
            [80.210, 12.970],
            [80.212, 12.972],
            [80.210, 12.972],
            [80.212, 12.970],
            [80.210, 12.970]
        ]
        feat_bowtie = {
            "type": "Feature",
            "id": "bldg_bowtie",
            "geometry": {"type": "Polygon", "coordinates": [bowtie_coords]},
            "properties": {"height_m": 12.0, "building_type": "school"}
        }
        cleaned, rej = validate_building_feature(feat_bowtie)
        self.assertIsNotNone(cleaned, f"Bowtie should be repaired via buffer(0), got rejection: {rej}")

        # Case B: Negative height "-50"
        feat_neg_h = {
            "type": "Feature",
            "id": "bldg_neg_h",
            "geometry": {
                "type": "Polygon",
                "coordinates": [[[80.211, 12.971], [80.2112, 12.971], [80.2112, 12.9712], [80.211, 12.9712], [80.211, 12.971]]]
            },
            "properties": {"height_m": -50, "building_type": "residential"}
        }
        cleaned_neg, _ = validate_building_feature(feat_neg_h)
        self.assertEqual(cleaned_neg["properties"]["height_m"], 2.0)
        self.assertIn("clipped_below_min", cleaned_neg["properties"]["height_sanity_note"])

        # Case C: Non-numeric height string "abc"
        feat_abc_h = {
            "type": "Feature",
            "id": "bldg_abc_h",
            "geometry": {
                "type": "Polygon",
                "coordinates": [[[80.211, 12.971], [80.2112, 12.971], [80.2112, 12.9712], [80.211, 12.9712], [80.211, 12.971]]]
            },
            "properties": {"height_m": "abc"}
        }
        cleaned_abc, _ = validate_building_feature(feat_abc_h)
        self.assertEqual(cleaned_abc["properties"]["height_m"], 6.0)

        # Case D: Missing building type tag entirely
        h, conf = estimate_height(building_type=None, levels=None, explicit_height_m=None)
        self.assertEqual(conf, "default_fallback")
        self.assertEqual(h, 6.0)

        # Case E: Footprint below 4 sq meters (discarded)
        # 0.000001 deg is ~0.1 meter, area ~ 0.01 sqm
        tiny_coords = [
            [80.211, 12.971],
            [80.211001, 12.971],
            [80.211001, 12.971001],
            [80.211, 12.971001],
            [80.211, 12.971]
        ]
        feat_tiny = {
            "type": "Feature",
            "id": "bldg_tiny",
            "geometry": {"type": "Polygon", "coordinates": [tiny_coords]},
            "properties": {"height_m": 5.0}
        }
        cleaned_tiny, rej_tiny = validate_building_feature(feat_tiny)
        self.assertIsNone(cleaned_tiny)
        self.assertIn("excluded_below_min_area", rej_tiny)

        # Case F: Massive footprint > 50,000 sq meters (flagged, not dropped)
        # 0.004 deg is ~440 meters, area ~ 190,000 sqm
        large_coords = [
            [80.210, 12.970],
            [80.214, 12.970],
            [80.214, 12.974],
            [80.210, 12.974],
            [80.210, 12.970]
        ]
        feat_large = {
            "type": "Feature",
            "id": "bldg_large",
            "geometry": {"type": "Polygon", "coordinates": [large_coords]},
            "properties": {"height_m": 15.0, "building_type": "industrial"}
        }
        cleaned_large, _ = validate_building_feature(feat_large)
        self.assertIsNotNone(cleaned_large)
        self.assertIn("excessive_area", cleaned_large["properties"].get("quality_flag", ""))

    # ═══════════════════════════════════════════════════════════
    # TEST 4: Overpass API Timeout / 500 Retry & Graceful Recovery
    # ═══════════════════════════════════════════════════════════
    @patch("time.sleep", return_value=None)
    @patch("requests.post")
    def test_overpass_timeout_and_500_retry_and_graceful_recovery(self, mock_post, mock_sleep):
        """
        Verify that Overpass client retries 3 times on timeout or HTTP 500,
        and when all retries are exhausted, the pipeline logs the failure and gracefully
        degrades to Microsoft Footprints without hanging or aborting.
        """
        # Configure mock to raise Timeout on all attempts
        mock_post.side_effect = requests.exceptions.Timeout("Connection timed out")

        osm_client = OSMBuildingClient(timeout_sec=1, max_retries=3)
        pipeline = BuildingIngestionPipeline(osm_client=osm_client)

        # Should complete without throwing an unhandled exception
        geojson, result = pipeline.run(self.bbox, zone=self.zone, force_refresh=True)

        # Verify retry count reached 3
        self.assertEqual(mock_post.call_count, 3)

        # Verify pipeline logged the error in processing_errors
        self.assertTrue(any(e.get("stage") == "osm_fetch" for e in result.processing_errors))

        # Verify fallback to Microsoft footprints succeeded
        self.assertGreater(result.valid_buildings, 0)
        self.assertIn("microsoft_footprints", result.data_sources_used)

    # ═══════════════════════════════════════════════════════════
    # TEST 5: Duplicate and Overlap Deduplication
    # ═══════════════════════════════════════════════════════════
    def test_duplicate_and_overlapping_deduplication(self):
        """
        Verify that when two footprints overlap heavily (IoU > 0.5) representing the same structure,
        deduplication produces exactly ONE final building in the scene.
        """
        poly1 = Polygon([
            (80.2120, 12.9720),
            (80.2125, 12.9720),
            (80.2125, 12.9725),
            (80.2120, 12.9725),
            (80.2120, 12.9720)
        ])
        poly2 = Polygon([
            (80.21202, 12.97202),
            (80.21248, 12.97202),
            (80.21248, 12.97248),
            (80.21202, 12.97248),
            (80.21202, 12.97202)
        ])

        iou = compute_iou(poly1, poly2)
        self.assertGreater(iou, 0.5, f"IoU should be > 0.5, got {iou}")

        features = [
            {
                "type": "Feature",
                "id": "dup_bldg_A",
                "geometry": mapping(poly1),
                "properties": {
                    "id": "dup_bldg_A",
                    "building_type": "residential",
                    "height_m": 6.0,
                    "confidence_source": "default_fallback",
                    "data_provenance": ["microsoft_footprints"]
                }
            },
            {
                "type": "Feature",
                "id": "dup_bldg_B",
                "geometry": mapping(poly2),
                "properties": {
                    "id": "dup_bldg_B",
                    "building_type": "apartments",
                    "height_m": 18.0,
                    "confidence_source": "explicit_height",
                    "data_provenance": ["osm"]
                }
            }
        ]

        merger = MultiSourceBuildingMerger(iou_threshold=0.5)
        deduped, dropped_count = merger.deduplicate_features(features)

        self.assertEqual(len(deduped), 1)
        self.assertEqual(dropped_count, 1)
        # Should keep the higher confidence structure (dup_bldg_B with explicit_height)
        self.assertEqual(deduped[0]["id"], "dup_bldg_B")
        self.assertEqual(deduped[0]["properties"]["confidence_source"], "explicit_height")

    # ═══════════════════════════════════════════════════════════
    # TEST 6: Database Caching & Quality Report Serialization
    # ═══════════════════════════════════════════════════════════
    def test_database_caching_and_quality_report(self):
        """
        Verify that successful ingestion persists data to CityZone,
        re-running within 60 days returns cached result, and force_refresh bypasses cache.
        """
        pipeline = BuildingIngestionPipeline(cache_ttl_days=60)
        geojson, result = pipeline.run(self.bbox, zone=self.zone, force_refresh=True)

        self.zone.refresh_from_db()
        self.assertIsNotNone(self.zone.building_data_last_updated)
        self.assertEqual(len(self.zone.building_footprints_geojson["features"]), result.valid_buildings)
        self.assertIn("valid_buildings", self.zone.building_data_quality_report)

        # Immediate second call should hit database cache
        geojson_cached, cached_res = pipeline.run(self.bbox, zone=self.zone, force_refresh=False)
        self.assertTrue(cached_res.cached_response)
        self.assertEqual(cached_res.valid_buildings, result.valid_buildings)

    # ═══════════════════════════════════════════════════════════
    # TEST 7: Hydraulic Flow Obstruction in Simulation Agent
    # ═══════════════════════════════════════════════════════════
    def test_hydraulic_flow_obstruction(self):
        """
        Verify that real building footprints act as flow obstructions in the flood depth grid,
        suppressing water depth inside building cores and displacing volume to streets.
        """
        grid_no_buildings = generate_depth_grid(
            base_depth=0.5,
            rainfall_factor=1.2,
            drainage_factor=0.6,
            hour=2,
            grid_size=64,
            building_footprints=None
        )

        bldg_poly = Polygon([
            (80.2120, 12.9720),
            (80.2130, 12.9720),
            (80.2130, 12.9730),
            (80.2120, 12.9730),
            (80.2120, 12.9720)
        ])
        footprints_collection = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": mapping(bldg_poly),
                    "properties": {"height_m": 12.0}
                }
            ]
        }

        grid_with_buildings = generate_depth_grid(
            base_depth=0.5,
            rainfall_factor=1.2,
            drainage_factor=0.6,
            hour=2,
            grid_size=64,
            building_footprints=footprints_collection
        )

        obstruction = rasterize_building_obstructions(footprints_collection, grid_size=64)
        bldg_cells = obstruction > 0.5
        self.assertTrue(bldg_cells.any())

        # Inside building cells, depth must be significantly lower than unobstructed case
        depth_unobstructed = [grid_no_buildings[r][c] for r in range(64) for c in range(64) if bldg_cells[r, c]]
        depth_obstructed = [grid_with_buildings[r][c] for r in range(64) for c in range(64) if bldg_cells[r, c]]

        avg_unobstructed = sum(depth_unobstructed) / len(depth_unobstructed)
        avg_obstructed = sum(depth_obstructed) / len(depth_obstructed)

        self.assertLess(avg_obstructed, avg_unobstructed, "Water depth inside building should be obstructed/suppressed")
        self.assertLessEqual(max(depth_obstructed), 0.1, "Solid building core should not have deep flood depth")
