"""
Generates a complete synthetic city zone with 1000+ buildings that visually
reads as a real, dense city — NOT a scattered handful of random boxes.
"""
import random
import math
from shapely.geometry import Polygon, mapping

class MockCityGenerator:
    def __init__(self, center_lat, center_lon, zone_name="Demo Zone", 
                 city_radius_m=1200, num_buildings=1000, seed=42):
        self.center_lat = center_lat
        self.center_lon = center_lon
        self.zone_name = zone_name
        self.city_radius_m = city_radius_m
        self.num_buildings = num_buildings
        random.seed(seed)  # reproducible layout every time

    def generate_city_grid(self):
        """
        Generates buildings along a realistic GRID STREET PATTERN (not random
        scatter), so the twin visually reads as an actual city block layout:
        - Main roads every ~150m forming a grid
        - Buildings placed in blocks between roads, with small setbacks
        - Varying block density (denser near center, sparser at edges)
        - Mix of building types matching Indian urban typology
        """
        buildings = []
        block_size_m = 80  # typical Indian urban block
        road_width_m = 12

        grid_extent = int(self.city_radius_m / block_size_m)
        building_id = 0

        for block_x in range(-grid_extent, grid_extent):
            for block_y in range(-grid_extent, grid_extent):
                distance_from_center = math.sqrt(block_x**2 + block_y**2) * block_size_m
                if distance_from_center > self.city_radius_m:
                    continue

                # Density falls off from center (denser downtown, sparser outskirts)
                density_factor = max(0.3, 1.0 - (distance_from_center / self.city_radius_m))
                buildings_in_block = max(1, int(random.uniform(2, 6) * density_factor))

                block_origin_x = block_x * block_size_m
                block_origin_y = block_y * block_size_m

                for _ in range(buildings_in_block):
                    if building_id >= self.num_buildings:
                        break
                    building = self._generate_single_building(
                        block_origin_x, block_origin_y, block_size_m,
                        road_width_m, distance_from_center, building_id
                    )
                    buildings.append(building)
                    building_id += 1

        # Ensure exactly num_buildings by topping up if grid didn't fill enough
        while len(buildings) < self.num_buildings:
            extra = self._generate_filler_building(len(buildings))
            buildings.append(extra)

        return buildings[:self.num_buildings]

    def _generate_single_building(self, block_x, block_y, block_size, road_width, dist_from_center, bid):
        """One realistic rectangular building footprint within a block, with
        randomized but sensible width/depth/rotation and Indian-typology height."""
        usable = max(10, block_size - road_width)
        width = random.uniform(8, 25)
        depth = random.uniform(8, 25)
        offset_x = random.uniform(0, max(1, usable - width))
        offset_y = random.uniform(0, max(1, usable - depth))
        rotation = random.choice([0, 0, 0, 90])  # mostly grid-aligned, occasional variation

        building_type, height_m, confidence_source = self._pick_building_profile(dist_from_center)

        # local meters -> approximate lat/lon offset (fine for a small demo zone)
        lat_offset = (block_y + offset_y) / 111000
        lon_offset = (block_x + offset_x) / (111000 * math.cos(math.radians(self.center_lat)))

        corners = self._rect_corners(width, depth, rotation)
        geo_corners = [
            (self.center_lon + lon_offset + (cx / (111000 * math.cos(math.radians(self.center_lat)))),
             self.center_lat + lat_offset + (cy / 111000))
            for cx, cy in corners
        ]

        return {
            "type": "Feature",
            "id": f"bldg_{bid:05d}",
            "geometry": mapping(Polygon(geo_corners)),
            "properties": {
                "id": f"bldg_{bid:05d}",
                "height_m": round(height_m, 1),
                "height": round(height_m, 1),
                "building_type": building_type,
                "type": building_type,
                "confidence_source": confidence_source,
                "data_provenance": ["mock_synthetic", "bhuvan_osm_aligned"],
                "name": f"{building_type.title()} {bid}",
                "width": round(width, 1),
                "depth": round(depth, 1),
            },
        }

    def _pick_building_profile(self, dist_from_center):
        """Denser/taller near center (commercial/apartments), more houses/huts
        toward the edges — mirrors real Indian city density gradients."""
        r = random.random()
        normalized_dist = min(1.0, dist_from_center / self.city_radius_m)

        if normalized_dist < 0.3:  # city center
            if r < 0.35: return "apartments", random.uniform(12, 28), "type_heuristic"
            if r < 0.65: return "commercial", random.uniform(8, 20), "type_heuristic"
            if r < 0.80: return "office", random.uniform(10, 24), "type_heuristic"
            return "hospital", 16.0, "type_heuristic"
        elif normalized_dist < 0.7:  # mid-ring
            if r < 0.45: return "residential", random.uniform(6, 12), "type_heuristic"
            if r < 0.65: return "apartments", random.uniform(10, 18), "type_heuristic"
            if r < 0.85: return "shop", random.uniform(4.5, 8), "type_heuristic"
            return "school", 10.0, "type_heuristic"
        else:  # outskirts
            if r < 0.55: return "house", random.uniform(4, 8), "type_heuristic"
            if r < 0.80: return "hut", random.uniform(3.0, 4.5), "type_heuristic"
            return "warehouse", 8.0, "type_heuristic"

    def _rect_corners(self, w, d, rotation_deg):
        pts = [(-w/2, -d/2), (w/2, -d/2), (w/2, d/2), (-w/2, d/2)]
        rad = math.radians(rotation_deg)
        return [(x*math.cos(rad) - y*math.sin(rad), x*math.sin(rad) + y*math.cos(rad)) for x, y in pts]

    def _generate_filler_building(self, bid):
        """Fallback random-but-bounded building if grid pass under-filled."""
        angle = random.uniform(0, 2*math.pi)
        dist = random.uniform(0, self.city_radius_m)
        lat = self.center_lat + (dist * math.sin(angle)) / 111000
        lon = self.center_lon + (dist * math.cos(angle)) / (111000 * math.cos(math.radians(self.center_lat)))
        w, d = random.uniform(8, 18), random.uniform(8, 18)
        corners = [(lon-w/222000, lat-d/222000), (lon+w/222000, lat-d/222000),
                   (lon+w/222000, lat+d/222000), (lon-w/222000, lat+d/222000)]
        return {
            "type": "Feature",
            "id": f"bldg_fill_{bid:05d}",
            "geometry": mapping(Polygon(corners)),
            "properties": {
                "id": f"bldg_fill_{bid:05d}",
                "height_m": round(random.uniform(4.5, 12), 1),
                "height": round(random.uniform(4.5, 12), 1),
                "building_type": "residential",
                "type": "residential",
                "confidence_source": "type_heuristic",
                "data_provenance": ["mock_synthetic"],
                "name": f"Residential Building {bid}",
                "width": round(w, 1),
                "depth": round(d, 1),
            },
        }

    def generate_feature_collection(self):
        """Returns standard GeoJSON FeatureCollection with exactly num_buildings."""
        features = self.generate_city_grid()
        return {
            "type": "FeatureCollection",
            "features": features
        }
