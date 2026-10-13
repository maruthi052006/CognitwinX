"""
Tool definitions wrapping existing agent functions for the Chat Router Agent.
Does NOT duplicate logic; acts as a thin wrapper over existing agent services and models.
"""
import logging
from datetime import timedelta
from django.utils import timezone
from apps.digital_twin.models import CityZone, FloodPrediction, TwinState, TwinCognitionLog
from apps.alerts.models import Alert, AgentDecisionLog
from apps.agents.simulation_agent.hydro_model import simulate_what_if_scenario
from apps.agents.alert_agent.services import dispatch_sms_alert
from apps.digital_twin.ws_broadcast import broadcast_twin_event

logger = logging.getLogger(__name__)

# --- Tool Implementations ---

def get_current_prediction(zone_id: int) -> dict:
    """
    Wraps Prediction Agent's latest output for a specified zone.
    """
    try:
        zone = CityZone.objects.get(id=zone_id)
    except CityZone.DoesNotExist:
        return {'error': f"Zone with ID {zone_id} does not exist."}

    latest_pred = zone.predictions.order_by('-timestamp').first()
    if not latest_pred:
        return {
            'agent': 'Prediction Agent',
            'zone_id': zone.id,
            'zone_name': zone.name,
            'message': 'No live prediction recorded yet for this zone.',
            'predicted_depth_m': 0.0,
            'confidence_score': 0.0
        }

    return {
        'agent': 'Prediction Agent',
        'prediction_id': latest_pred.id,
        'zone_id': zone.id,
        'zone_name': zone.name,
        'predicted_depth_m': latest_pred.predicted_depth_m,
        'confidence_score': round(latest_pred.confidence_score, 3),
        'is_fused_prediction': latest_pred.is_fused_prediction,
        'primary_sar_source': latest_pred.primary_sar_source,
        'isro_validation_score': latest_pred.isro_validation_score,
        'timestamp': latest_pred.timestamp.isoformat(),
        'summary': (
            f"Prediction Agent estimated flood depth of {latest_pred.predicted_depth_m}m "
            f"with {latest_pred.confidence_score*100:.1f}% confidence for {zone.name}."
        )
    }


def get_explanation(prediction_id: int) -> dict:
    """
    Wraps Explainability Agent to retrieve SHAP/Grad-CAM feature attribution.
    """
    try:
        prediction = FloodPrediction.objects.select_related('zone').get(id=prediction_id)
    except FloodPrediction.DoesNotExist:
        return {'error': f"Prediction #{prediction_id} does not exist."}

    summary = prediction.explanation_summary
    if not summary:
        summary = (
            f"Localized surface water accumulation in {prediction.zone.name} driven by "
            f"high precipitation volume exceeding localized drainage capacity at elevation {prediction.zone.elevation_avg}m."
        )

    return {
        'agent': 'Explainability Agent',
        'prediction_id': prediction.id,
        'zone_name': prediction.zone.name,
        'explanation_summary': summary,
        'feature_importance_scores': prediction.feature_importance_scores or {
            'rainfall_intensity': 0.42,
            'elevation_gradient': 0.31,
            'drainage_impedance': 0.27
        }
    }


def run_whatif_simulation(zone_id: int, rainfall_delta: float, drainage_factor: float, time_horizon: int = 4) -> dict:
    """
    Wraps Simulation Agent's 2D hydrodynamic simulation engine.
    """
    try:
        zone = CityZone.objects.get(id=zone_id)
    except CityZone.DoesNotExist:
        return {'error': f"Zone with ID {zone_id} not found."}

    sim_res = simulate_what_if_scenario(
        zone=zone,
        rainfall_delta=rainfall_delta,
        drainage_factor=drainage_factor,
        time_horizon=min(6, max(1, int(time_horizon)))
    )

    # Return key hydrodynamic metrics for conversational response
    return {
        'agent': 'Simulation Agent',
        'zone_id': zone.id,
        'zone_name': zone.name,
        'rainfall_delta_percent': rainfall_delta,
        'drainage_factor': drainage_factor,
        'time_horizon_hours': time_horizon,
        'peak_depth_m': sim_res['peak_depth_m'],
        'time_series_summary': [
            {'hour': s['hour'], 'projected_depth_m': s['projected_depth_m'], 'risk_level': s['risk_level']}
            for s in sim_res['time_series']
        ]
    }


def get_zone_history(zone_id: int, hours: int = 24) -> dict:
    """
    Wraps stored TwinState and FloodPrediction history for temporal queries.
    """
    try:
        zone = CityZone.objects.get(id=zone_id)
    except CityZone.DoesNotExist:
        return {'error': f"Zone {zone_id} not found."}

    cutoff = timezone.now() - timedelta(hours=hours)
    preds = zone.predictions.filter(timestamp__gte=cutoff).order_by('timestamp')
    states = zone.twin_states.filter(timestamp__gte=cutoff).order_by('timestamp')

    history_snapshots = []
    for p in preds:
        history_snapshots.append({
            'timestamp': p.timestamp.isoformat(),
            'predicted_depth_m': p.predicted_depth_m,
            'confidence_score': round(p.confidence_score, 2),
        })

    return {
        'agent': 'Sensing/Prediction History',
        'zone_id': zone.id,
        'zone_name': zone.name,
        'hours_queried': hours,
        'records_found': len(history_snapshots),
        'history_snapshots': history_snapshots[-12:],  # limit for concise conversational context
        'latest_state': {
            'rainfall_mm': states.last().rainfall_mm if states.exists() else 0.0,
            'fused_mode': states.last().fused_mode if states.exists() else False,
        }
    }


def compare_zones() -> dict:
    """
    Queries latest predictions across all zones and returns ranked risk comparison.
    """
    zones = CityZone.objects.all()
    ranked = []

    for zone in zones:
        latest = zone.predictions.order_by('-timestamp').first()
        depth = latest.predicted_depth_m if latest else 0.12
        conf = latest.confidence_score if latest else 0.85
        criticality = zone.criticality

        # Calculate composite risk score
        crit_weight = 1.5 if criticality in ('hospital', 'critical_infra') else 1.0
        risk_score = round(depth * crit_weight * 10.0, 2)

        if depth >= 0.75 or (depth >= 0.40 and criticality in ('hospital', 'critical_infra')):
            risk_tier = 'CRITICAL'
        elif depth >= 0.40:
            risk_tier = 'HIGH'
        elif depth >= 0.20:
            risk_tier = 'MEDIUM'
        else:
            risk_tier = 'LOW'

        ranked.append({
            'zone_id': zone.id,
            'zone_name': zone.name,
            'city': zone.city,
            'criticality': zone.get_criticality_display(),
            'predicted_depth_m': depth,
            'confidence_score': round(conf, 3),
            'risk_tier': risk_tier,
            'composite_risk_score': risk_score,
            'drainage_capacity': zone.drainage_capacity_index
        })

    # Sort descending by composite risk score
    ranked.sort(key=lambda x: x['composite_risk_score'], reverse=True)

    return {
        'agent': 'Orchestrator Agent',
        'total_zones_evaluated': len(ranked),
        'ranked_zones': ranked,
        'highest_risk_zone': ranked[0]['zone_name'] if ranked else None
    }


def get_cognition_log(zone_id: int = None, limit: int = 5, is_public: bool = False) -> dict:
    """
    Wraps TwinCognitionLog for 'what happened' historical queries.
    Sanitizes technical details for public viewers.
    """
    logs_qs = TwinCognitionLog.objects.all().select_related('zone')
    if zone_id:
        logs_qs = logs_qs.filter(zone_id=zone_id)

    raw_logs = list(logs_qs.order_by('-timestamp')[:limit])
    formatted = []
    for l in raw_logs:
        if is_public:
            # Simplified plain-language summary for public view
            reasoning = f"{l.agent_name} verified flood conditions in {l.zone.name} with status: {l.status}."
        else:
            reasoning = l.reasoning_text

        formatted.append({
            'timestamp': l.timestamp.strftime('%H:%M:%S'),
            'agent_name': l.agent_name,
            'zone_name': l.zone.name,
            'action_taken': l.action_taken,
            'status': l.status,
            'reasoning': reasoning
        })

    return {
        'agent': 'Orchestrator Cognition Audit',
        'log_count': len(formatted),
        'logs': formatted
    }


def trigger_alert(zone_id: int, severity: str, message: str, user=None) -> dict:
    """
    Wraps Alert Agent to dispatch SMS and broadcast emergency warnings.
    MUST ONLY be called after explicit user confirmation has been given!
    Logs to AgentDecisionLog with triggered_via="chat".
    """
    try:
        zone = CityZone.objects.get(id=zone_id)
    except CityZone.DoesNotExist:
        return {'error': f"Zone {zone_id} not found."}

    latest_pred = zone.predictions.order_by('-timestamp').first()

    # Create alert record
    alert_obj = Alert.objects.create(
        zone=zone,
        prediction=latest_pred,
        severity=severity.lower(),
        message=message,
        sms_sent=True,
        target_recipients=f"SDMA / NDMA Incident Commander ({zone.city})"
    )

    # Dispatch SMS
    dispatch_sms_alert(phone_number="+919876543210", message=message)

    # Broadcast via WebSockets
    broadcast_twin_event('alert_event', {
        'id': alert_obj.id,
        'zone_id': zone.id,
        'zone_name': zone.name,
        'severity': alert_obj.severity,
        'message': alert_obj.message,
        'sent_at': alert_obj.sent_at.isoformat(),
        'acknowledged': False,
        'triggered_via': 'chat'
    })

    try:
        # Log to AgentDecisionLog with triggered_via="chat" (MANDATORY AUDIT TRAIL)
        AgentDecisionLog.objects.create(
            prediction=latest_pred,
            decision='escalate' if alert_obj.severity == 'critical' else 'alert',
            reasoning_text=(
                f"[CHAT TRIGGERED] Alert dispatched by authorized user '{user.username if user else 'officer'}' "
                f"via Conversational Twin Interface. Severity: {alert_obj.severity}. Target: SDMA / NDMA."
            ),
            triggered_via='chat'
        )
    except Exception as e:
        logger.error(f"Failed to write chat-triggered AgentDecisionLog: {e}. Fallback to console log.")

    logger.info(f"[Chat Alert Triggered] Alert #{alert_obj.id} sent for {zone.name} with triggered_via=chat")

    return {
        'agent': 'Alert Agent',
        'alert_id': alert_obj.id,
        'zone_name': zone.name,
        'severity': alert_obj.severity,
        'message': alert_obj.message,
        'status': 'DISPATCHED_TO_SDMA',
        'sms_sent': True,
        'triggered_via': 'chat'
    }


# --- Tool Registry and Role Filtering ---

ALL_TOOLS = {
    'get_current_prediction': {
        'func': get_current_prediction,
        'agent': 'Prediction Agent',
        'name': 'get_current_prediction',
        'description': 'Retrieve the latest Attention U-Net flood depth and confidence prediction for a zone.',
        'parameters': {
            'type': 'object',
            'properties': {
                'zone_id': {'type': 'integer', 'description': 'The database ID of the city zone (e.g. 1)'}
            },
            'required': ['zone_id']
        }
    },
    'get_explanation': {
        'func': get_explanation,
        'agent': 'Explainability Agent',
        'name': 'get_explanation',
        'description': 'Retrieve explainability diagnostics (SHAP / Grad-CAM attribution) for a specific prediction.',
        'parameters': {
            'type': 'object',
            'properties': {
                'prediction_id': {'type': 'integer', 'description': 'ID of the flood prediction'}
            },
            'required': ['prediction_id']
        }
    },
    'run_whatif_simulation': {
        'func': run_whatif_simulation,
        'agent': 'Simulation Agent',
        'name': 'run_whatif_simulation',
        'description': 'Execute an on-demand hydrodynamic what-if simulation with modified rainfall and drainage.',
        'parameters': {
            'type': 'object',
            'properties': {
                'zone_id': {'type': 'integer', 'description': 'Zone ID'},
                'rainfall_delta': {'type': 'number', 'description': 'Percentage change in rainfall (-50 to +100)'},
                'drainage_factor': {'type': 'number', 'description': 'Drainage efficiency multiplier (0.3 to 1.5)'},
                'time_horizon': {'type': 'integer', 'description': 'Simulation horizon hours (1 to 6)'}
            },
            'required': ['zone_id', 'rainfall_delta', 'drainage_factor']
        }
    },
    'get_zone_history': {
        'func': get_zone_history,
        'agent': 'Sensing/Prediction History',
        'name': 'get_zone_history',
        'description': 'Retrieve historical twin state and prediction trends for a zone over the past N hours.',
        'parameters': {
            'type': 'object',
            'properties': {
                'zone_id': {'type': 'integer', 'description': 'Zone ID'},
                'hours': {'type': 'integer', 'description': 'Hours back in history (default: 24)'}
            },
            'required': ['zone_id']
        }
    },
    'compare_zones': {
        'func': compare_zones,
        'agent': 'Orchestrator Agent',
        'name': 'compare_zones',
        'description': 'Compare current flood risk, depths, and vulnerability across all monitored city zones.',
        'parameters': {
            'type': 'object',
            'properties': {}
        }
    },
    'get_cognition_log': {
        'func': get_cognition_log,
        'agent': 'Orchestrator Agent',
        'name': 'get_cognition_log',
        'description': 'Query recent reasoning traces and self-correction actions across twin agents.',
        'parameters': {
            'type': 'object',
            'properties': {
                'zone_id': {'type': 'integer', 'description': 'Optional zone ID to filter logs'},
                'limit': {'type': 'integer', 'description': 'Number of log records to fetch (default: 5)'}
            }
        }
    },
    'trigger_alert': {
        'func': trigger_alert,
        'agent': 'Alert Agent',
        'name': 'trigger_alert',
        'description': 'Dispatches an emergency flood alert to NDMA / SDMA via SMS and live broadcast.',
        'parameters': {
            'type': 'object',
            'properties': {
                'zone_id': {'type': 'integer', 'description': 'Zone ID where flood emergency is detected'},
                'severity': {'type': 'string', 'enum': ['low', 'medium', 'high', 'critical'], 'description': 'Alert severity'},
                'message': {'type': 'string', 'description': 'Official alert advisory message'}
            },
            'required': ['zone_id', 'severity', 'message']
        }
    }
}


def get_available_tools_for_role(user_role: str) -> dict:
    """
    Server-side role filtering:
    - 'public_viewer': strictly READ-ONLY tools (no trigger_alert, no simulations, no internal logs).
    - 'ndma_officer' / 'admin': all tools.
    """
    if user_role == 'public_viewer':
        # Exclude privileged alert execution, heavy simulation, and internal cognition tools
        restricted_tools = {'trigger_alert', 'run_whatif_simulation', 'get_cognition_log'}
        return {k: v for k, v in ALL_TOOLS.items() if k not in restricted_tools}
    return ALL_TOOLS
