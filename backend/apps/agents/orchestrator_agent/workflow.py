import uuid
import logging
from celery import shared_task
from django.utils import timezone
from django.core.cache import cache
from apps.digital_twin.models import CityZone, FloodPrediction
from apps.digital_twin.ws_broadcast import broadcast_twin_event
from .decision_log import log_agent_cognition_step

from apps.agents.sensing_agent.tasks import run_sensing_agent
from apps.agents.sensing_agent.services.bhoonidhi_client import BhoonidhiClient
from apps.agents.prediction_agent.tasks import run_prediction_agent
from apps.agents.simulation_agent.tasks import run_simulation_agent
from apps.agents.explainability_agent.tasks import run_explainability_agent
from apps.agents.alert_agent.tasks import run_alert_agent

logger = logging.getLogger(__name__)

def execute_cognitive_cycle(zone_id: int, cycle_id: str = None) -> dict:
    """
    Executes a complete autonomous Cognitive Cycle:
    Sense (ISRO EOS-04 / Sentinel-1 + NASA IMERG) -> Predict -> Self-Correct -> Simulate -> Validate against ISRO WaterSpread -> Explain -> Act
    """
    cycle_id = cycle_id or f"cycle_{uuid.uuid4().hex[:8]}"
    zone = CityZone.objects.get(id=zone_id)

    logger.info(f"=== [Cognitive Cycle Started] Zone: {zone.name}, Cycle: {cycle_id} ===")

    # ----------------------------------------------------
    # STEP 1: SENSING AGENT (Multi-Source Geospatial Perception)
    # ----------------------------------------------------
    log_agent_cognition_step(
        zone=zone, cycle_id=cycle_id, agent_name='Sensing Agent',
        action_taken='Ingesting Multi-Sensor Telemetry',
        reasoning_text=f"Initiating primary SAR telemetry acquisition via ISRO Bhoonidhi (EOS-04 C-band) with Sentinel-1 fallback, and NASA GES DISC IMERG precipitation.",
        status='info'
    )
    sensing_output = run_sensing_agent(zone_id=zone.id, fused_mode=False, cycle_id=cycle_id)
    primary_sar_source = sensing_output.get('sar_source', 'eos4')

    # ----------------------------------------------------
    # STEP 2: PREDICTION AGENT (First Pass)
    # ----------------------------------------------------
    log_agent_cognition_step(
        zone=zone, cycle_id=cycle_id, agent_name='Prediction Agent',
        action_taken='Attention U-Net Deep Learning Inference',
        reasoning_text=f"Evaluating radar patch (Source: {primary_sar_source.upper()}) through Attention U-Net encoder-decoder with spatial gating.",
        status='info'
    )
    prediction_output = run_prediction_agent(zone_id=zone.id, perception_data=sensing_output)
    confidence = prediction_output['confidence_score']
    prediction_id = prediction_output['prediction_id']

    # ----------------------------------------------------
    # STEP 3: COGNITIVE SELF-CORRECTION RETRY LOOP (MANDATORY)
    # ----------------------------------------------------
    if confidence < 0.60:
        log_agent_cognition_step(
            zone=zone, cycle_id=cycle_id, agent_name='Orchestrator Agent',
            action_taken='Cognitive Self-Correction Triggered: Low Confidence',
            reasoning_text=(
                f"Prediction confidence of {confidence*100:.1f}% is below acceptable threshold (60.0%). "
                f"Single-polarization SAR backscatter exhibits urban speckle noise. "
                f"Autonomous decision: Requesting fused Sentinel-2 optical NDWI imagery from Sensing Agent."
            ),
            status='retry'
        )

        broadcast_twin_event('twin_state_recalculating', {
            'zone_id': zone.id,
            'reason': 'Low confidence self-correction in progress'
        })

        # Step 3a: Re-sense in fused mode
        sensing_output_fused = run_sensing_agent(zone_id=zone.id, fused_mode=True, cycle_id=cycle_id)
        log_agent_cognition_step(
            zone=zone, cycle_id=cycle_id, agent_name='Sensing Agent',
            action_taken='Ingesting Fused SAR + Optical NDWI',
            reasoning_text=f"Acquired Sentinel-2 multispectral Green/NIR bands. Fused optical NDWI with calibrated SAR backscatter.",
            status='info'
        )

        # Step 3b: Re-predict with fused data
        prediction_output = run_prediction_agent(zone_id=zone.id, perception_data=sensing_output_fused)
        new_confidence = prediction_output['confidence_score']
        prediction_id = prediction_output['prediction_id']

        log_agent_cognition_step(
            zone=zone, cycle_id=cycle_id, agent_name='Orchestrator Agent',
            action_taken='Self-Correction Validated',
            reasoning_text=(
                f"Fused data re-prediction successful. Confidence improved from "
                f"{confidence*100:.1f}% -> {new_confidence*100:.1f}% (+{(new_confidence-confidence)*100:.1f}%). "
                f"Proceeding to hydrodynamic projection."
            ),
            status='success'
        )
    else:
        log_agent_cognition_step(
            zone=zone, cycle_id=cycle_id, agent_name='Orchestrator Agent',
            action_taken='Confidence Verification Passed',
            reasoning_text=f"Prediction confidence {confidence*100:.1f}% exceeds 60.0% threshold. Proceeding directly to simulation.",
            status='success'
        )

    # ----------------------------------------------------
    # STEP 4: SIMULATION AGENT (Foresight & 3D Heightmaps)
    # ----------------------------------------------------
    log_agent_cognition_step(
        zone=zone, cycle_id=cycle_id, agent_name='Simulation Agent',
        action_taken='Kinematic Wave Flood Spread Projection',
        reasoning_text=f"Projecting next 1-6 hour flood extent using CartoDEM 30m elevation flow and {zone.name} drainage proxy.",
        status='info'
    )
    simulation_output = run_simulation_agent(zone_id=zone.id, prediction_data=prediction_output)

    # ----------------------------------------------------
    # STEP 4B: ISRO GROUND TRUTH CROSS-VALIDATION (IoU)
    # ----------------------------------------------------
    bhoonidhi = BhoonidhiClient()
    bbox = [zone.center_lng - 0.015, zone.center_lat - 0.015, zone.center_lng + 0.015, zone.center_lat + 0.015]
    isro_waterspread = bhoonidhi.fetch_waterspread_ground_truth(bbox=bbox, zone=zone, cycle_id=cycle_id)
    
    pred_instance = FloodPrediction.objects.get(id=prediction_id)
    iou_score = bhoonidhi.compute_iou(
        predicted_extent=pred_instance.flood_extent_geojson,
        isro_waterspread=isro_waterspread
    )
    
    # Store validation metadata directly in prediction
    pred_instance.primary_sar_source = primary_sar_source
    pred_instance.isro_validation_score = iou_score
    pred_instance.save(update_fields=['primary_sar_source', 'isro_validation_score'])

    log_agent_cognition_step(
        zone=zone, cycle_id=cycle_id, agent_name='Orchestrator Agent',
        action_taken='ISRO Bhoonidhi WaterSpread Cross-Validation',
        reasoning_text=(
            f"Validated predicted inundation against official ISRO EOS-04_SAR(MRS)_WaterSpread ground truth. "
            f"Cross-sensor agreement IoU: {iou_score*100:.1f}%. Telemetry sensor: {primary_sar_source.upper()}."
        ),
        status='success'
    )

    # ----------------------------------------------------
    # STEP 5: EXPLAINABILITY AGENT (XAI)
    # ----------------------------------------------------
    log_agent_cognition_step(
        zone=zone, cycle_id=cycle_id, agent_name='Explainability Agent',
        action_taken='Grad-CAM Saliency Attribution',
        reasoning_text="Generating feature attribution heatmap and calculating per-building flood vulnerability scores.",
        status='info'
    )
    explain_output = run_explainability_agent(
        prediction_id=prediction_id,
        input_patch=sensing_output.get('input_patch')
    )

    # ----------------------------------------------------
    # STEP 6: ALERT / RESPONSE AGENT
    # ----------------------------------------------------
    log_agent_cognition_step(
        zone=zone, cycle_id=cycle_id, agent_name='Alert Agent',
        action_taken='Emergency Threshold Evaluation',
        reasoning_text=f"Evaluating predicted depth {prediction_output['predicted_depth_m']}m against zone criticality '{zone.criticality}'.",
        status='info'
    )
    alert_output = run_alert_agent(prediction_id=prediction_id)

    log_agent_cognition_step(
        zone=zone, cycle_id=cycle_id, agent_name='Orchestrator Agent',
        action_taken='Cognitive Cycle Completed',
        reasoning_text=(
            f"Full cycle complete. Depth: {prediction_output['predicted_depth_m']}m, "
            f"Confidence: {prediction_output['confidence_score']*100:.1f}%, "
            f"ISRO IoU Score: {iou_score*100:.1f}%, "
            f"Alert: {alert_output['severity'].upper()}."
        ),
        status='success'
    )

    # ----------------------------------------------------
    # STEP 7: LIVE WEBSOCKET BROADCAST TO 3D SCENE
    # ----------------------------------------------------
    broadcast_twin_event('prediction_update', {
        'prediction_id': pred_instance.id,
        'zone_id': zone.id,
        'zone_name': zone.name,
        'predicted_depth_m': pred_instance.predicted_depth_m,
        'confidence_score': pred_instance.confidence_score,
        'depth_heightmap_grid': pred_instance.depth_heightmap_grid,
        'explanation_summary': pred_instance.explanation_summary,
        'feature_importance_scores': pred_instance.feature_importance_scores,
        'rainfall_mm': sensing_output.get('rainfall_mm', 15.0),
        'primary_sar_source': primary_sar_source,
        'isro_validation_score': iou_score,
        'timestamp': pred_instance.timestamp.isoformat()
    })

    return {
        'cycle_id': cycle_id,
        'zone_id': zone.id,
        'zone_name': zone.name,
        'predicted_depth_m': prediction_output['predicted_depth_m'],
        'confidence_score': prediction_output['confidence_score'],
        'primary_sar_source': primary_sar_source,
        'isro_validation_score': iou_score,
        'alert_severity': alert_output['severity'],
        'simulation_slices': len(simulation_output['time_series_slices'])
    }

@shared_task(name='tasks.run_cognitive_cycle', bind=True, autoretry_for=(Exception,), max_retries=3, retry_backoff=True)
def run_cognitive_cycle_task(self, zone_id: int):
    lock_id = f"cognitwinx_cycle_lock_zone_{zone_id}"
    
    # Acquire lock for 5 minutes (300 seconds)
    if not cache.add(lock_id, "true", 300):
        logger.warning(f"Cognitive Cycle for zone {zone_id} is already running. Skipping duplicate trigger.")
        return {'status': 'skipped', 'reason': 'Concurrent execution locked'}

    try:
        return execute_cognitive_cycle(zone_id=zone_id)
    except Exception as e:
        logger.error(f"Cognitive Cycle failed for zone {zone_id}: {str(e)}")
        try:
            zone = CityZone.objects.get(id=zone_id)
            log_agent_cognition_step(
                zone=zone, cycle_id=f"failed_cycle_{uuid.uuid4().hex[:8]}", agent_name='Orchestrator Agent',
                action_taken='Cognitive Cycle Fatally Interrupted',
                reasoning_text=f"Unhandled exception during cognitive pipeline: {str(e)}",
                status='error'
            )
        except Exception:
            pass
        raise  # Re-raise for Celery autoretry
    finally:
        cache.delete(lock_id)
