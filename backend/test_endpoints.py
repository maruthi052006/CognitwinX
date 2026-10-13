import os
import django
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.test import Client

client = Client()

print("--- Testing API Endpoints ---")

# 1. Chat Message Endpoint
res = client.post('/api/chat/message/', data=json.dumps({
    'message': 'Compare all zones for me'
}), content_type='application/json')
print("POST /api/chat/message/ ->", res.status_code)
assert res.status_code == 200, f"Expected 200, got {res.status_code}"
chat_data = res.json()
session_id = chat_data['session_id']
print("  Response message length:", len(chat_data['twin_response']['content']))

# 2. Chat Session Detail Endpoint
res_detail = client.get(f'/api/chat/sessions/{session_id}/')
print(f"GET /api/chat/sessions/{session_id}/ ->", res_detail.status_code)
assert res_detail.status_code == 200
print("  Messages count:", len(res_detail.json()['messages']))

# 3. Historical Replay Endpoint
from apps.digital_twin.models import CityZone
first_zone = CityZone.objects.first()
res_replay = client.get(f'/api/zones/{first_zone.id}/replay/?event_date=2023-12-04')
print(f"GET /api/zones/{first_zone.id}/replay/ ->", res_replay.status_code)
assert res_replay.status_code == 200
replay_data = res_replay.json()
print(f"  Reconstructed {len(replay_data['snapshots'])} snapshots and {len(replay_data['cognition_logs'])} cognition logs.")

# 4. Infrastructure Risk Flags Endpoint
res_flags = client.get('/api/infrastructure/risk-flags/')
print("GET /api/infrastructure/risk-flags/ ->", res_flags.status_code)
assert res_flags.status_code == 200
print("  Risk flags count:", len(res_flags.json()))

# 5. Zone Risk Comparison Endpoint
res_comp = client.get('/api/zones/comparison/')
print("GET /api/zones/comparison/ ->", res_comp.status_code)
assert res_comp.status_code == 200
print("  Ranked zones count:", len(res_comp.json()['ranked_zones']))

print("\n>>> ALL API ENDPOINTS VERIFIED SUCCESSFULLY (200 OK)! <<<")
