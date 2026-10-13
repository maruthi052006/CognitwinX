import { useTwinStore } from '../store/twinStore';

class TwinWebSocketClient {
  constructor() {
    this.socket = null;
    this.reconnectTimer = null;
    this.isConnected = false;
  }

  connect() {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/live-updates/`;

    console.log('[WebSocket] Connecting to:', wsUrl);
    this.socket = new WebSocket(wsUrl);

    this.socket.onopen = () => {
      console.log('[WebSocket] Connected to Cognitive Twin real-time feed');
      this.isConnected = true;
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    };

    this.socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (err) {
        console.error('[WebSocket] Error parsing event data:', err);
      }
    };

    this.socket.onclose = (e) => {
      console.warn('[WebSocket] Disconnected. Scheduling reconnect in 3s...', e.reason);
      this.isConnected = false;
      this.reconnectTimer = setTimeout(() => this.connect(), 3000);
    };

    this.socket.onerror = (err) => {
      console.error('[WebSocket] Connection error:', err);
    };
  }

  handleMessage(data) {
    const store = useTwinStore.getState();
    const eventType = data.event_type;
    const payload = data.payload;

    switch (eventType) {
      case 'cognition_step':
        store.addCognitionLog(payload);
        break;

      case 'prediction_update':
        store.handleLivePredictionUpdate(payload);
        break;

      case 'alert_event':
        store.addAlert(payload);
        break;

      case 'alert_acknowledged':
        store.markAlertAcknowledged(payload.id);
        break;

      case 'twin_state_recalculating':
        useTwinStore.setState({ isRecalculating: true });
        break;

      default:
        // Handle direct consumer greetings
        if (data.type === 'connection_established') {
          console.log('[WebSocket Status]', data.message);
        }
        break;
    }
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.socket) {
      this.socket.close();
    }
  }
}

export const wsClient = new TwinWebSocketClient();
