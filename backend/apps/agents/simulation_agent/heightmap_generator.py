import numpy as np
import math
from typing import Any, Optional, Union
from shapely.geometry import shape

def generate_base_dem_elevation(elevation_avg: float = 12.0, grid_size: int = 64) -> np.ndarray:
    """
    Generates realistic DEM elevation heightmap for an urban river/drainage basin.
    Terrain features:
      - Gentle slope toward center drainage/lake (e.g. Pallikaranai marsh or Bellandur lake)
      - Natural micro-topography variations (roads, mounds, low points)
    """
    y, x = np.mgrid[0:grid_size, 0:grid_size]
    nx = (x - grid_size / 2.0) / (grid_size / 2.0)
    ny = (y - grid_size / 2.0) / (grid_size / 2.0)

    # Basin depression towards center
    basin_dish = 0.4 * (nx**2 + 0.8 * ny**2)

    # Meandering natural nallah / storm drain canal
    canal = 0.6 * np.exp(-((ny - 0.25 * np.sin(nx * 3.5))**2) / 0.04)

    # High ground on northern/western ridge
    ridge = 0.3 * (nx - ny)

    dem_normalized = np.clip(ridge + basin_dish - canal, -1.0, 1.0)
    # Scale to elevation in meters
    dem_meters = elevation_avg + dem_normalized * (elevation_avg * 0.45)
    return dem_meters.astype(np.float32)


def rasterize_building_obstructions(building_footprints: Any, grid_size: int = 64) -> np.ndarray:
    """
    Rasterizes building footprint polygons onto the simulation grid.
    Returns a float array (0.0 to 1.0) where 1.0 represents impermeable building mass.
    """
    obstruction = np.zeros((grid_size, grid_size), dtype=np.float32)
    if not building_footprints:
        return obstruction

    features = []
    if isinstance(building_footprints, dict):
        features = building_footprints.get("features", [])
    elif isinstance(building_footprints, list):
        features = building_footprints

    if not features:
        return obstruction

    # Collect valid geometries
    geoms = []
    for f in features:
        if isinstance(f, dict):
            geom_data = f.get("geometry")
            if geom_data:
                try:
                    s = shape(geom_data)
                    if s.is_valid and not s.is_empty:
                        geoms.append(s)
                except Exception:
                    continue

    if not geoms:
        return obstruction

    # Compute bounding box of all building footprints
    minx = min(g.bounds[0] for g in geoms)
    miny = min(g.bounds[1] for g in geoms)
    maxx = max(g.bounds[2] for g in geoms)
    maxy = max(g.bounds[3] for g in geoms)

    span_x = max(1e-6, maxx - minx)
    span_y = max(1e-6, maxy - miny)

    for g in geoms:
        b_minx, b_miny, b_maxx, b_maxy = g.bounds
        # Map to grid indices [0, grid_size - 1]
        c0 = int(np.clip((b_minx - minx) / span_x * (grid_size - 1), 0, grid_size - 1))
        c1 = int(np.clip((b_maxx - minx) / span_x * (grid_size - 1), 0, grid_size - 1))
        r0 = int(np.clip((b_miny - miny) / span_y * (grid_size - 1), 0, grid_size - 1))
        r1 = int(np.clip((b_maxy - miny) / span_y * (grid_size - 1), 0, grid_size - 1))

        # Mark building cells
        obstruction[min(r0, r1):max(r0, r1) + 1, min(c0, c1):max(c0, c1) + 1] = 1.0

    return obstruction


def generate_depth_grid(
    base_depth: float,
    rainfall_factor: float,
    drainage_factor: float,
    hour: int,
    grid_size: int = 64,
    building_footprints: Optional[Any] = None
) -> list:
    """
    Generates a 64x64 normalized depth grid for time step `hour`.
    Water accumulates in lower depressions first, expanding outwards.
    When `building_footprints` are provided, buildings act as genuine physical
    flow obstructions: impermeable structures displace water into adjacent street
    canyons, deflecting and focusing flood depth into surrounding pathways.
    """
    y, x = np.mgrid[0:grid_size, 0:grid_size]
    center = grid_size / 2.0

    # Flood peak scales with time and rainfall
    time_curve = 1.0 - math.exp(-hour * 0.65)
    effective_peak = base_depth * (1.0 + 0.5 * time_curve) * rainfall_factor / max(0.2, drainage_factor)

    # Radial propagation along natural drain axis
    dist_from_canal = np.abs((y - center) - 8 * np.sin((x - center) / 10.0))
    dist_from_center = np.sqrt((x - center)**2 + (y - center)**2)

    water_spread = np.exp(-dist_from_canal / 12.0) * 0.7 + np.exp(-dist_from_center / 22.0) * 0.3
    depth_array = np.clip(water_spread * effective_peak, 0.0, 3.0)

    # Flow Obstruction & Hydraulic Displacement logic
    if building_footprints:
        obstruction = rasterize_building_obstructions(building_footprints, grid_size=grid_size)
        is_building = obstruction > 0.5

        if np.any(is_building):
            # Calculate water displaced by impermeable solid building mass
            displaced_depth = depth_array[is_building].copy()
            total_displaced = np.sum(displaced_depth)

            # Inside solid building core, water depth is drastically reduced / blocked
            depth_array[is_building] = np.minimum(depth_array[is_building] * 0.1, 0.08)

            # Displaced water deflects into adjacent street corridors (perimeter cells)
            non_building = ~is_building
            non_building_count = np.count_nonzero(non_building)
            if non_building_count > 0:
                surge_per_cell = (total_displaced * 0.85) / non_building_count
                depth_array[non_building] = np.clip(depth_array[non_building] + surge_per_cell, 0.0, 3.5)

    # Return as 2D python list of floats rounded to 3 decimal places
    grid = []
    for r in range(grid_size):
        grid.append([round(float(depth_array[r, c]), 3) for c in range(grid_size)])
    return grid
