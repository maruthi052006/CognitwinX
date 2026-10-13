import logging
from celery import shared_task
from apps.digital_twin.models import CityZone, FloodPrediction
from .ml_engine.inference import predict_flood

logger = logging.getLogger(__name__)

@shared_task(name='tasks.run_prediction_agent')
def run_prediction_agent(zone_id: int, perception_data: dict) -> dict:
    """
    AGENT 2 — PREDICTION AGENT (Cognitive Core)
    - Attention U-Net segmentation
    - Confidence calculation
    - Rapid depth estimation
    - Saves FloodPrediction to DB
    """
    zone = CityZone.objects.get(id=zone_id)
    rainfall_mm = perception_data.get('rainfall_mm', 15.0)
    input_patch = perception_data.get('input_patch')
    fused_mode = perception_data.get('fused_mode', False)

    # Run inference
    pred_results = predict_flood(
        input_patch=input_patch,
        rainfall_mm=rainfall_mm,
        elevation_avg=zone.elevation_avg,
        drainage_capacity=zone.drainage_capacity_index,
        fused_mode=fused_mode
    )

    # Synthetic GeoJSON flood polygon representation
    center_lat = zone.center_lat
    center_lng = zone.center_lng
    span = 0.008 * (0.8 + 0.5 * pred_results['flood_extent_ratio'])

    flood_polygon = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {
                    "zone_name": zone.name,
                    "depth_m": pred_results['predicted_depth_m'],
                    "confidence": pred_results['confidence_score'],
                    "fused": fused_mode
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[
                        [center_lng - span, center_lat - span],
                        [center_lng + span, center_lat - span * 0.8],
                        [center_lng + span * 1.1, center_lat + span],
                        [center_lng - span * 0.9, center_lat + span * 1.2],
                        [center_lng - span, center_lat - span]
                    ]]
                }
            }
        ]
    }

    # Save to database
    prediction = FloodPrediction.objects.create(
        zone=zone,
        flood_extent_geojson=flood_polygon,
        predicted_depth_m=pred_results['predicted_depth_m'],
        confidence_score=pred_results['confidence_score'],
        depth_heightmap_grid=pred_results['depth_heightmap_grid'],
        is_fused_prediction=fused_mode
    )

    logger.info(
        f"[Prediction Agent] Zone: {zone.name}, Depth: {prediction.predicted_depth_m}m, "
        f"Conf: {prediction.confidence_score:.3f}, Fused: {fused_mode}"
    )

    return {
        'prediction_id': prediction.id,
        'zone_id': zone.id,
        'zone_name': zone.name,
        'predicted_depth_m': pred_results['predicted_depth_m'],
        'confidence_score': pred_results['confidence_score'],
        'depth_heightmap_grid': pred_results['depth_heightmap_grid'],
        'flood_extent_geojson': flood_polygon,
        'fused_mode': fused_mode,
        'benchmark_metrics': pred_results['benchmark_metrics']
    }
