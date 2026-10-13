import logging
from celery import shared_task
from apps.digital_twin.models import FloodPrediction
from apps.alerts.models import Alert, AgentDecisionLog
from apps.digital_twin.ws_broadcast import broadcast_twin_event
from .services import dispatch_sms_alert

logger = logging.getLogger(__name__)

@shared_task(name='tasks.run_alert_agent')
def run_alert_agent(prediction_id: int) -> dict:
    """
    AGENT 5 — ALERT / RESPONSE AGENT (The Twin's Hands)
    - Evaluates prediction depth and confidence against decision rules
    - Escalates severity based on zone criticality (Hospital, School, Infra)
    - Dispatches Twilio SMS & updates AgentDecisionLog
    - Broadcasts real-time alert event over WebSockets
    """
    prediction = FloodPrediction.objects.get(id=prediction_id)
    zone = prediction.zone
    depth = prediction.predicted_depth_m
    conf = prediction.confidence_score
    criticality = zone.criticality

    # Decision Logic
    if conf < 0.60:
        # Confidence too low -> do not alert yet, flag for re-check
        decision = 'log_only'
        reasoning = (
            f"Prediction confidence ({conf*100:.1f}%) is below actionable threshold (60.0%). "
            f"Alert suppressed to prevent false alarms. Flagged for sensor re-check."
        )
        alert_obj = None
    elif depth < 0.30:
        decision = 'log_only'
        reasoning = (
            f"Predicted flood depth ({depth}m) is below warning threshold (0.30m). "
            f"Conditions logged in normal monitoring cycle."
        )
        alert_obj = None
    else:
        # Depth >= 0.30m & Confidence >= 0.60 -> ALERT or ESCALATE
        if criticality in ['hospital', 'school', 'critical_infra'] or depth >= 0.75:
            severity = 'critical'
            decision = 'escalate'
            reasoning = (
                f"ESCALATION: Depth {depth}m in high-vulnerability zone '{zone.name}' "
                f"(Criticality: {zone.get_criticality_display()}). Autonomous emergency alert triggered."
            )
        elif depth >= 0.45:
            severity = 'high'
            decision = 'alert'
            reasoning = (
                f"HIGH FLOOD ALERT: Depth {depth}m exceeding municipal safety margin. "
                f"Evacuation advisory sent to ward disaster response."
            )
        else:
            severity = 'medium'
            decision = 'alert'
            reasoning = f"MEDIUM WARNING: Localized inundation {depth}m expected along low-lying roadways."

        message = (
            f"[NDMA/COGNITWIN {severity.upper()}] {zone.name} ({zone.city}): "
            f"Flood depth projected at {depth}m (Conf: {conf*100:.0f}%). "
            f"{'Immediate evacuation recommended for hospital/school perimeter.' if severity == 'critical' else 'Avoid underpasses and low-lying transit lanes.'}"
        )

        alert_obj = Alert.objects.create(
            zone=zone,
            prediction=prediction,
            severity=severity,
            message=message,
            sms_sent=True,
            target_recipients=f"NDMA Control, {zone.city} Disaster Response Force, Ward 12"
        )

        # Dispatch simulated/Twilio SMS
        dispatch_sms_alert(phone_number="+919876543210", message=message)

        # Broadcast via WebSockets
        broadcast_twin_event('alert_event', {
            'id': alert_obj.id,
            'zone_id': zone.id,
            'zone_name': zone.name,
            'severity': severity,
            'message': message,
            'sent_at': alert_obj.sent_at.isoformat(),
            'acknowledged': False
        })

    try:
        # Log to AgentDecisionLog
        decision_log = AgentDecisionLog.objects.create(
            prediction=prediction,
            decision=decision,
            reasoning_text=reasoning
        )
    except Exception as e:
        logger.error(f"Failed to write AgentDecisionLog to database: {e}. Fallback to console log.")
        decision_log = None

    logger.info(f"[Alert Agent] Zone: {zone.name}, Decision: {decision}, Reasoning: {reasoning[:60]}...")

    return {
        'decision': decision,
        'reasoning': reasoning,
        'alert_id': alert_obj.id if alert_obj else None,
        'severity': alert_obj.severity if alert_obj else 'none',
        'sms_dispatched': alert_obj.sms_sent if alert_obj else False
    }
