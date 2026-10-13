"""
Multi-source building data merger and deduplication engine.
Executes Section 2 selection logic:
- Computes geographic bbox area and evaluates OSM building density.
- Falls back to Microsoft Footprints if OSM is sparse/unreliable.
- Fuses Microsoft footprints (base geometry) with OSM real height/level tags via IoU matching.
- Deduplicates overlapping structures (IoU > 0.5).
- Maintains strict per-building data provenance.
"""
from __future__ import annotations
import logging
from typing import Any, Dict, List, Optional, Tuple
from shapely.geometry import shape, box
from shapely import STRtree
from .validator import compute_iou, calculate_approx_area_sqm, sanitize_and_repair_geometry

logger = logging.getLogger(__name__)

# Default density threshold: 1 building per 2000 sq meters
DEFAULT_AREA_PER_BUILDING_SQM = 2000.0
IOU_MATCH_THRESHOLD = 0.5


class MultiSourceBuildingMerger:
    """
    Implements rule-based fusion of OSM, Microsoft Footprints, and elevation data.
    """
    def __init__(
        self,
        area_per_building_sqm: float = DEFAULT_AREA_PER_BUILDING_SQM,
        iou_threshold: float = IOU_MATCH_THRESHOLD
    ):
        self.area_per_building_sqm = area_per_building_sqm
        self.iou_threshold = iou_threshold

    def calculate_bbox_density_threshold(self, bbox: Tuple[float, float, float, float]) -> int:
        """
        Calculates minimum required building count for OSM to be considered reliable.
        Formula: bbox_area_sqm / area_per_building_sqm
        """
        south, west, north, east = bbox
        bbox_geom = box(west, south, east, north)
        area_sqm = calculate_approx_area_sqm(bbox_geom)
        threshold = max(5, int(area_sqm / self.area_per_building_sqm))
        return threshold

    def merge(
        self,
        osm_features: List[Dict[str, Any]],
        ms_features: List[Dict[str, Any]],
        bbox: Tuple[float, float, float, float]
    ) -> Tuple[List[Dict[str, Any]], List[str], Dict[str, Any]]:
        """
        Executes multi-source merge logic.
        
        Returns:
          (merged_features, data_sources_used, merge_telemetry)
        """
        density_threshold = self.calculate_bbox_density_threshold(bbox)
        osm_count = len(osm_features)
        ms_count = len(ms_features)

        logger.info(
            f"Merge evaluation: OSM count={osm_count}, MS count={ms_count}, "
            f"density threshold={density_threshold}"
        )

        sources_used = []
        telemetry = {
            "osm_count": osm_count,
            "ms_count": ms_count,
            "density_threshold": density_threshold,
            "osm_reliable": True,
            "transferred_height_count": 0,
            "deduplicated_count": 0
        }

        # Case 1: OSM is below density threshold -> UNRELIABLE
        if osm_count < density_threshold:
            logger.info("OSM building count is below density threshold. Using Microsoft Footprints as primary.")
            telemetry["osm_reliable"] = False
            sources_used.append("microsoft_footprints")

            if ms_count > 0:
                final_features = list(ms_features)
            else:
                # If MS also empty, take whatever OSM has rather than returning nothing
                final_features = list(osm_features)
                if final_features:
                    sources_used.append("osm")

            return final_features, sources_used, telemetry

        # Case 2: Microsoft footprints empty but OSM is good
        if ms_count == 0 and osm_count >= density_threshold:
            logger.info("Microsoft footprints empty; using OSM as primary geometry.")
            sources_used.append("osm")
            return osm_features, sources_used, telemetry

        # Case 3: Both sources return usable data -> MERGE
        logger.info("Both OSM and Microsoft datasets usable. Merging geometry & attributes...")
        sources_used.extend(["microsoft_footprints", "osm"])

        # Parse OSM shapes and index them
        osm_geoms = []
        valid_osm_feats = []
        for feat in osm_features:
            gdict = feat.get("geometry")
            if not isinstance(gdict, dict):
                continue
            g, err = sanitize_and_repair_geometry(gdict)
            if g and not err:
                osm_geoms.append(g)
                valid_osm_feats.append(feat)

        osm_tree = STRtree(osm_geoms) if osm_geoms else None
        merged_features: List[Dict[str, Any]] = []
        matched_osm_indices = set()
        transferred_height_count = 0

        # Iterate over Microsoft footprints (base geometry layer)
        for ms_feat in ms_features:
            ms_gdict = ms_feat.get("geometry")
            if not isinstance(ms_gdict, dict):
                continue
            ms_g, err = sanitize_and_repair_geometry(ms_gdict)
            if not ms_g or err:
                continue

            ms_props = dict(ms_feat.get("properties") or {})
            provenance = list(ms_props.get("data_provenance") or ["microsoft_footprints"])

            if osm_tree is not None:
                # Find candidate overlapping OSM buildings
                candidates = osm_tree.query(ms_g, predicate="intersects")
                best_iou = 0.0
                best_osm_feat = None
                best_osm_idx = None

                for c_idx in candidates:
                    osm_g = osm_geoms[c_idx]
                    iou = compute_iou(ms_g, osm_g)
                    if iou > best_iou:
                        best_iou = iou
                        best_osm_feat = valid_osm_feats[c_idx]
                        best_osm_idx = c_idx

                if best_iou > self.iou_threshold and best_osm_feat is not None:
                    matched_osm_indices.add(best_osm_idx)
                    osm_props = best_osm_feat.get("properties") or {}
                    osm_conf = osm_props.get("confidence_source")

                    # If OSM has real tags (explicit_height or levels_tag), transfer them!
                    if osm_conf in ("explicit_height", "levels_tag"):
                        ms_props["height_m"] = osm_props.get("height_m")
                        ms_props["confidence_source"] = osm_conf
                        ms_props["transferred_from_osm_id"] = best_osm_feat.get("id")
                        if osm_props.get("raw_levels"):
                            ms_props["raw_levels"] = osm_props.get("raw_levels")
                        if osm_props.get("raw_height"):
                            ms_props["raw_height"] = osm_props.get("raw_height")
                        transferred_height_count += 1
                        if "osm_height_transfer" not in provenance:
                            provenance.append("osm_height_transfer")

                    # Also transfer specific building name or type if available
                    if osm_props.get("name") and not ms_props.get("name"):
                        ms_props["name"] = osm_props.get("name")
                    if osm_props.get("building_type") and osm_props.get("building_type") != "yes":
                        ms_props["building_type"] = osm_props.get("building_type")

            ms_props["data_provenance"] = provenance
            merged_features.append({
                "type": "Feature",
                "id": ms_feat.get("id"),
                "geometry": ms_feat.get("geometry"),
                "properties": ms_props
            })

        # Append unmatched OSM buildings (distinct physical structures not present in MS)
        for idx, osm_feat in enumerate(valid_osm_feats):
            if idx not in matched_osm_indices:
                osm_props = dict(osm_feat.get("properties") or {})
                osm_prov = list(osm_props.get("data_provenance") or ["osm"])
                osm_props["data_provenance"] = osm_prov
                merged_features.append({
                    "type": "Feature",
                    "id": osm_feat.get("id"),
                    "geometry": osm_feat.get("geometry"),
                    "properties": osm_props
                })

        # Deduplication check: prevent any residual duplicate polygons with IoU > 0.5
        deduped_features, dedup_count = self.deduplicate_features(merged_features)
        telemetry["transferred_height_count"] = transferred_height_count
        telemetry["deduplicated_count"] = dedup_count

        return deduped_features, sources_used, telemetry

    def deduplicate_features(
        self,
        features: List[Dict[str, Any]]
    ) -> Tuple[List[Dict[str, Any]], int]:
        """
        Deduplicates any overlapping geometries (IoU > iou_threshold).
        Prioritizes features with higher-confidence height data.
        """
        if len(features) <= 1:
            return features, 0

        # Confidence priority score
        conf_priority = {
            "explicit_height": 4,
            "levels_tag": 3,
            "bhuvan_lidar_dsm": 3,
            "type_heuristic": 2,
            "default_fallback": 1
        }

        # Build list of parsed geometries
        items = []
        for feat in features:
            gdict = feat.get("geometry")
            if not isinstance(gdict, dict):
                continue
            g, err = sanitize_and_repair_geometry(gdict)
            if g and not err:
                props = feat.get("properties") or {}
                conf = props.get("confidence_source", "default_fallback")
                score = conf_priority.get(conf, 1)
                items.append((g, feat, score))

        if not items:
            return [], 0

        geoms = [it[0] for it in items]
        tree = STRtree(geoms)
        dropped_indices = set()

        for i, (g1, feat1, score1) in enumerate(items):
            if i in dropped_indices:
                continue

            candidates = tree.query(g1, predicate="intersects")
            for j in candidates:
                if i >= j or j in dropped_indices:
                    continue
                g2, feat2, score2 = items[j]
                iou = compute_iou(g1, g2)
                if iou > self.iou_threshold:
                    # Drop the one with lower priority score, or the smaller one
                    if score1 >= score2:
                        dropped_indices.add(j)
                    else:
                        dropped_indices.add(i)
                        break

        retained = [items[i][1] for i in range(len(items)) if i not in dropped_indices]
        return retained, len(dropped_indices)
