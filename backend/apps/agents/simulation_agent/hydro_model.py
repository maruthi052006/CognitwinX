import math
from .heightmap_generator import generate_depth_grid

def simulate_future_spread(zone, base_depth: float, rainfall_mm: float, hours_ahead: int = 6) -> list:
    """
    Simulates projected flood spread for the next 1 to 6 hours.
    Returns list of time-series slices with depth metrics and 64x64 heightmaps.
    """
    drainage = zone.drainage_capacity_index
    bldg_footprints = getattr(zone, 'building_footprints_geojson', None)
    time_series = []

    for h in range(1, hours_ahead + 1):
        rain_scale = 1.0 + 0.15 * math.log(h + 1)
        projected_depth = round(base_depth * (1.0 + 0.35 * (1.0 - math.exp(-h * 0.5))), 2)
        grid = generate_depth_grid(
            base_depth=base_depth,
            rainfall_factor=rain_scale,
            drainage_factor=drainage,
            hour=h,
            grid_size=64,
            building_footprints=bldg_footprints
        )

        time_series.append({
            'time_step': f"T+{h}h",
            'hour': h,
            'projected_depth_m': projected_depth,
            'flooded_area_sqkm': round(0.85 + 0.32 * h, 2),
            'depth_heightmap_grid': grid,
        })

    return time_series

def simulate_what_if_scenario(zone, rainfall_delta: float, drainage_factor: float, time_horizon: int = 4) -> dict:
    """
    Executes an on-demand what-if scenario.
    Parameters:
      - rainfall_delta: % change in rainfall (-50% to +100%)
      - drainage_factor: multiplier on drainage capacity (0.3 to 1.5)
      - time_horizon: 1 to 6 hours
    """
    effective_rain_mult = max(0.2, 1.0 + (rainfall_delta / 100.0))
    effective_drainage = max(0.1, min(1.0, zone.drainage_capacity_index * drainage_factor))
    base_depth = 0.28 * effective_rain_mult / max(0.3, effective_drainage)
    bldg_footprints = getattr(zone, 'building_footprints_geojson', None)

    time_series = []
    for h in range(1, time_horizon + 1):
        grid = generate_depth_grid(
            base_depth=base_depth,
            rainfall_factor=effective_rain_mult,
            drainage_factor=effective_drainage,
            hour=h,
            grid_size=64,
            building_footprints=bldg_footprints
        )
        depth_at_step = round(base_depth * (0.8 + 0.3 * math.log(h + 1)), 2)

        time_series.append({
            'hour': h,
            'time_label': f"+{h} hr",
            'projected_depth_m': depth_at_step,
            'risk_level': 'critical' if depth_at_step > 0.8 else ('high' if depth_at_step > 0.4 else 'medium'),
            'depth_heightmap_grid': grid,
        })

    return {
        'scenario_status': 'computed',
        'zone_id': zone.id,
        'zone_name': zone.name,
        'rainfall_delta_percent': rainfall_delta,
        'drainage_factor': drainage_factor,
        'time_horizon_hours': time_horizon,
        'peak_depth_m': max(s['projected_depth_m'] for s in time_series),
        'time_series': time_series,
        'hydro_model': '2D Kinematic Wave + Elevation Gradient Flow Proxy'
    }
