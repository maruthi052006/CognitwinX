import os, sys, django, json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.test import Client
from apps.digital_twin.models import CityZone
from apps.alerts.models import Alert
from apps.users.models import UserProfile
from django.contrib.auth.models import User

client = Client()

print("==================================================")
print("--- 2.5: EXHAUSTIVE API ENDPOINTS SYSTEM TEST ---")
print("==================================================")

zone = CityZone.objects.first()
zone_id = zone.id if zone else 1

test_results = []

def record(endpoint, method, status, expected_status, payload_type, body_snippet):
    ok = (status == expected_status)
    test_results.append({
        'endpoint': endpoint,
        'method': method,
        'payload_type': payload_type,
        'status': status,
        'expected': expected_status,
        'ok': ok,
        'response_preview': body_snippet[:150]
    })
    print(f"[{'PASS' if ok else 'FAIL'}] {method} {endpoint} ({payload_type}) -> HTTP {status} (Expected: {expected_status})")

# 1. Zones list & details
res = client.get('/api/zones/')
record('/api/zones/', 'GET', res.status_code, 200, 'Valid GET', str(res.json())[:100])

res = client.get(f'/api/zones/{zone_id}/')
record(f'/api/zones/{zone_id}/', 'GET', res.status_code, 200, 'Valid GET', str(res.json())[:100])

res = client.get('/api/zones/999999/')
record('/api/zones/999999/', 'GET', res.status_code, 404, 'Invalid ID', res.content.decode())

# 2. Zone History & Replay
res = client.get(f'/api/zones/{zone_id}/history/')
record(f'/api/zones/{zone_id}/history/', 'GET', res.status_code, 200, 'Valid GET', str(res.json())[:100])

res = client.get(f'/api/zones/{zone_id}/replay/?event_date=2023-12-04')
record(f'/api/zones/{zone_id}/replay/?event_date=2023-12-04', 'GET', res.status_code, 200, 'Valid Query', str(res.json())[:100])

res = client.get('/api/zones/999999/replay/?event_date=2023-12-04')
record('/api/zones/999999/replay/', 'GET', res.status_code, 404, 'Invalid Zone ID', res.content.decode())

# 3. Zone Comparison & Risk Flags
res = client.get('/api/zones/comparison/')
record('/api/zones/comparison/', 'GET', res.status_code, 200, 'Valid GET', str(res.json())[:100])

res = client.get('/api/infrastructure/risk-flags/')
record('/api/infrastructure/risk-flags/', 'GET', res.status_code, 200, 'Valid GET', str(res.json())[:100])

# 4. What-If Simulation
res = client.post('/api/simulate/what-if/', data=json.dumps({
    'zone_id': zone_id,
    'rainfall_delta': 25,
    'drainage_factor': 0.7,
    'time_horizon': 3
}), content_type='application/json')
record('/api/simulate/what-if/', 'POST', res.status_code, 200, 'Valid What-If Payload', str(res.json())[:100])

# Deliberately invalid What-If: missing required zone_id
res = client.post('/api/simulate/what-if/', data=json.dumps({
    'rainfall_delta': 25
}), content_type='application/json')
record('/api/simulate/what-if/', 'POST', res.status_code, 400, 'Invalid Missing zone_id Payload', res.content.decode())

# 5. Predictions & Cognition Logs
res = client.get('/api/predictions/latest/')
record('/api/predictions/latest/', 'GET', res.status_code, 200, 'Valid GET', str(res.json())[:100])

res = client.get('/api/agent/cognition-log/')
record('/api/agent/cognition-log/', 'GET', res.status_code, 200, 'Valid GET', str(res.json())[:100])

# 6. Alerts & Acknowledgement
res = client.get('/api/alerts/')
record('/api/alerts/', 'GET', res.status_code, 200, 'Valid GET', str(res.json())[:100])

alert = Alert.objects.first()
if not alert and zone:
    alert = Alert.objects.create(zone=zone, severity='medium', message='Test alert')

alert_id = alert.id if alert else 1
res = client.post(f'/api/alerts/{alert_id}/acknowledge/', data=json.dumps({}), content_type='application/json')
record(f'/api/alerts/{alert_id}/acknowledge/', 'POST', res.status_code, 200, 'Valid Acknowledge', str(res.json())[:100])

res = client.post('/api/alerts/999999/acknowledge/', data=json.dumps({}), content_type='application/json')
record('/api/alerts/999999/acknowledge/', 'POST', res.status_code, 404, 'Invalid Alert ID', res.content.decode())

# 7. Agent Trigger Cycle
res = client.post('/api/agent/trigger-cycle/', data=json.dumps({
    'zone_id': zone_id
}), content_type='application/json')
record('/api/agent/trigger-cycle/', 'POST', res.status_code, 200, 'Valid Trigger Payload', str(res.json())[:100])

res = client.post('/api/agent/trigger-cycle/', data=json.dumps({}), content_type='application/json')
record('/api/agent/trigger-cycle/', 'POST', res.status_code, 400, 'Invalid Empty Payload', res.content.decode())

# 8. Chat Message & Session Detail
res = client.post('/api/chat/message/', data=json.dumps({
    'message': 'What is the flood status in this zone?',
    'zone_id': zone_id
}), content_type='application/json')
record('/api/chat/message/', 'POST', res.status_code, 200, 'Valid Chat Message', str(res.json())[:100])
session_id = res.json().get('session_id')

res = client.post('/api/chat/message/', data=json.dumps({
    'message': ''
}), content_type='application/json')
record('/api/chat/message/', 'POST', res.status_code, 400, 'Invalid Empty Message', res.content.decode())

if session_id:
    res = client.get(f'/api/chat/sessions/{session_id}/')
    record(f'/api/chat/sessions/{session_id}/', 'GET', res.status_code, 200, 'Valid Session Detail', str(res.json())[:100])

res = client.get('/api/chat/sessions/999999/')
record('/api/chat/sessions/999999/', 'GET', res.status_code, 404, 'Invalid Session ID', res.content.decode())

# 9. Auth endpoints
res = client.post('/api/auth/token/', data=json.dumps({
    'username': 'nonexistent_user',
    'password': 'bad_password'
}), content_type='application/json')
record('/api/auth/token/', 'POST', res.status_code, 401, 'Invalid Credentials', res.content.decode())

# Summary
failed = [r for r in test_results if not r['ok']]
print(f"\n==================================================")
print(f"Total endpoints tested: {len(test_results)}")
print(f"Passed: {len(test_results) - len(failed)}")
print(f"Failed: {len(failed)}")
print(f"==================================================")
assert len(failed) == 0, f"{len(failed)} endpoints failed verification!"
