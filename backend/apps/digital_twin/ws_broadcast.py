import logging
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

logger = logging.getLogger(__name__)

def broadcast_twin_event(event_type: str, payload: dict):
    """
    Utility function to broadcast live events to all connected clients on /ws/live-updates/
    Supports:
      - cognition_step: an agent's reasoning or action
      - prediction_update: new flood prediction with depth and extent
      - heightmap_update: 2D depth grid for 3D water mesh
      - alert_event: new critical or warning alert
      - simulation_preview: what-if live preview state
    """
    channel_layer = get_channel_layer()
    if not channel_layer:
        return

    data = {
        'event_type': event_type,
        'payload': payload,
    }

    try:
        async_to_sync(channel_layer.group_send)(
            'twin_updates',
            {
                'type': 'broadcast_event',
                'data': data,
            }
        )
    except Exception as e:
        logger.warning(f"Failed to broadcast websocket event: {e}")
