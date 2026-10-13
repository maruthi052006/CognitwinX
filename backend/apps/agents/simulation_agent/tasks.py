import logging
from celery import shared_task
from apps.digital_twin.models import CityZone, FloodPrediction
from .hydro_model import simulate_future_spread

logger = logging.getLogger(__name__)

@shared_task(name='tasks.run_simulation_agent')
def run_simulation_agent(zone_id: int, prediction_data: dict) -> dict:
    """
    AGENT 3 — SIMULATION AGENT (Foresight)
    - Receives latest prediction and zone state
    - Projects 1-6 hour future flood spread time series
    - Generates 64x64 depth heightmap grid series for 3D animated water
    """
    zone = CityZone.objects.get(id=zone_id)
    base_depth = prediction_data.get('predicted_depth_m', 0.25)
    rainfall_mm = prediction_data.get('rainfall_mm', 20.0)

    time_series = simulate_future_spread(
        zone=zone,
        base_depth=base_depth,
        rainfall_mm=rainfall_mm,
        hours_ahead=6
    )

    logger.info(f"[Simulation Agent] Projected 6-hour spread for {zone.name}. Max depth: {time_series[-1]['projected_depth_m']}m")

    return {
        'zone_id': zone.id,
        'zone_name': zone.name,
        'time_series_slices': time_series,
        'immediate_next_heightmap': time_series[0]['depth_heightmap_grid']
    }
