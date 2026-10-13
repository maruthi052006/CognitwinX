import logging
from apps.digital_twin.models import TwinCognitionLog, CityZone
from apps.digital_twin.ws_broadcast import broadcast_twin_event

logger = logging.getLogger(__name__)

def log_agent_cognition_step(zone: CityZone, cycle_id: str, agent_name: str, action_taken: str, reasoning_text: str, status: str = 'info') -> TwinCognitionLog:
    """
    Records an entry in the TwinCognitionLog and immediately broadcasts it to all
    connected WebSocket clients for the live 'Twin Cognition Feed' UI.
    """
    try:
        log_entry = TwinCognitionLog.objects.create(
            zone=zone,
            cycle_id=cycle_id,
            agent_name=agent_name,
            action_taken=action_taken,
            reasoning_text=reasoning_text,
            status=status
        )
        entry_id = log_entry.id
        timestamp_iso = log_entry.timestamp.isoformat()
    except Exception as e:
        logger.error(f"Failed to write TwinCognitionLog to database: {e}. Fallback to console log.")
        # Create a dummy object to satisfy broadcast
        from django.utils import timezone
        entry_id = -1
        timestamp_iso = timezone.now().isoformat()
        log_entry = None

    logger.info(f"[{agent_name}] [{status.upper()}] {action_taken}: {reasoning_text[:80]}...")

    broadcast_twin_event('cognition_step', {
        'id': entry_id,
        'zone_id': zone.id,
        'zone_name': zone.name,
        'cycle_id': cycle_id,
        'agent_name': agent_name,
        'action_taken': action_taken,
        'reasoning_text': reasoning_text,
        'status': status,
        'timestamp': timestamp_iso
    })

    return log_entry
