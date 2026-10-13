const API_BASE = '/api';

function getAuthHeaders(customHeaders = {}) {
  const token = localStorage.getItem('access_token');
  const headers = { ...customHeaders };
  if (token && token !== 'demo_token') {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export const api = {
  // Zones
  async getZones() {
    const res = await fetch(`${API_BASE}/zones/`);
    if (!res.ok) throw new Error('Failed to fetch zones');
    const data = await res.json();
    return Array.isArray(data) ? data : (data.results || []);
  },

  async getZoneTwinState(zoneId) {
    const res = await fetch(`${API_BASE}/zones/${zoneId}/twin-state/`);
    if (!res.ok) throw new Error('Failed to fetch twin state');
    return res.json();
  },

  async getZoneHistory(zoneId) {
    const res = await fetch(`${API_BASE}/zones/${zoneId}/history/`);
    if (!res.ok) throw new Error('Failed to fetch zone history');
    return res.json();
  },

  async getZoneWeather(zoneId) {
    const res = await fetch(`${API_BASE}/zones/${zoneId}/weather/`);
    if (!res.ok) throw new Error('Failed to fetch zone weather telemetry');
    return res.json();
  },


  // Predictions & Explainability
  async getLatestPredictions() {
    const res = await fetch(`${API_BASE}/predictions/latest/`);
    if (!res.ok) throw new Error('Failed to fetch predictions');
    return res.json();
  },

  async getPredictionExplain(predictionId) {
    const res = await fetch(`${API_BASE}/predictions/${predictionId}/explain/`);
    if (!res.ok) throw new Error('Failed to fetch explanation');
    return res.json();
  },

  // What-If Simulation
  async simulateWhatIf({ zone_id, rainfall_delta, drainage_factor, time_horizon }) {
    const res = await fetch(`${API_BASE}/simulate/what-if/`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ zone_id, rainfall_delta, drainage_factor, time_horizon })
    });
    if (!res.ok) throw new Error('Failed to execute simulation');
    return res.json();
  },

  // Cognition Logs & Orchestration
  async getCognitionLogs() {
    const res = await fetch(`${API_BASE}/agent/cognition-log/`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch cognition logs');
    return res.json();
  },

  async triggerCognitiveCycle(zoneId) {
    const res = await fetch(`${API_BASE}/agent/run-cycle/`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ zone_id: zoneId })
    });
    if (!res.ok) throw new Error('Failed to trigger cognitive cycle');
    return res.json();
  },

  // Alerts
  async getAlerts() {
    const res = await fetch(`${API_BASE}/alerts/`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch alerts');
    return res.json();
  },

  async acknowledgeAlert(alertId, role = 'ndma_officer') {
    const res = await fetch(`${API_BASE}/alerts/${alertId}/acknowledge/`, {
      method: 'PATCH',
      headers: getAuthHeaders({
        'Content-Type': 'application/json',
        'X-User-Role': role
      })
    });
    if (!res.ok) throw new Error('Failed to acknowledge alert');
    return res.json();
  },

  async login(username, password) {
    const res = await fetch(`${API_BASE}/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (!res.ok) {
      // fallback to token endpoint if legacy
      const resLegacy = await fetch(`${API_BASE}/auth/token/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (!resLegacy.ok) throw new Error('Invalid credentials');
      return resLegacy.json();
    }
    return res.json();
  },

  async register(userData) {
    const res = await fetch(`${API_BASE}/auth/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.username?.[0] || 'Registration failed');
    }
    return res.json();
  },

  getSatelliteTileUrl(zoneId) {
    return `${API_BASE}/zones/${zoneId}/satellite-tile/`;
  },

  async getCurrentUser(token) {
    const res = await fetch(`${API_BASE}/users/me/`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to load user profile');
    return res.json();
  },

  // Conversational Chat with the Twin (7th Agent)
  async sendChatMessage({ sessionId, message, zoneId, language = 'en', role = 'ndma_officer' }) {
    const res = await fetch(`${API_BASE}/chat/message/`, {
      method: 'POST',
      headers: getAuthHeaders({
        'Content-Type': 'application/json',
        'X-User-Role': role
      }),
      body: JSON.stringify({
        session_id: sessionId,
        message,
        zone_id: zoneId,
        language
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.detail || 'Failed to send chat message');
    }
    return res.json();
  },

  async getChatSessions(role = 'ndma_officer') {
    const res = await fetch(`${API_BASE}/chat/sessions/`, {
      headers: getAuthHeaders({ 'X-User-Role': role })
    });
    if (!res.ok) throw new Error('Failed to fetch chat sessions');
    return res.json();
  },

  async getChatSessionDetail(sessionId, role = 'ndma_officer') {
    const res = await fetch(`${API_BASE}/chat/sessions/${sessionId}/`, {
      headers: getAuthHeaders({ 'X-User-Role': role })
    });
    if (!res.ok) throw new Error('Failed to fetch chat session detail');
    return res.json();
  },

  async createChatSession(zoneId, role = 'ndma_officer') {
    const res = await fetch(`${API_BASE}/chat/sessions/`, {
      method: 'POST',
      headers: getAuthHeaders({
        'Content-Type': 'application/json',
        'X-User-Role': role
      }),
      body: JSON.stringify({ zone_id: zoneId })
    });
    if (!res.ok) throw new Error('Failed to create chat session');
    return res.json();
  },

  // Historical Replay Mode
  async getHistoricalReplay(zoneId, eventDate = '2023-12-04') {
    const res = await fetch(`${API_BASE}/zones/${zoneId}/replay/?event_date=${eventDate}`);
    if (!res.ok) throw new Error('Failed to fetch historical replay');
    return res.json();
  },

  // Infrastructure Risk Flags & Upgrade Priorities
  async getInfrastructureRiskFlags() {
    const res = await fetch(`${API_BASE}/infrastructure/risk-flags/`);
    if (!res.ok) throw new Error('Failed to fetch infrastructure risk flags');
    return res.json();
  },

  // Bhuvan ISRO WMS Integration
  async getBhuvanCapabilities() {
    const res = await fetch(`${API_BASE}/zones/bhuvan/capabilities/`);
    if (!res.ok) throw new Error('Failed to fetch Bhuvan capabilities');
    return res.json();
  },

  getBhuvanWmsProxyUrl() {
    return `${API_BASE}/zones/bhuvan/wms/`;
  },

  // Cross-Zone Risk Comparison
  async getZoneComparison() {
    const res = await fetch(`${API_BASE}/zones/comparison/`);
    if (!res.ok) throw new Error('Failed to fetch zone comparison');
    return res.json();
  }
};


