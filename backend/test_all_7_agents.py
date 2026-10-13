import os, sys, django, inspect, json

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

import apps.agents.sensing_agent.tasks as sa
import apps.agents.prediction_agent.tasks as pa
import apps.agents.simulation_agent.tasks as sia
import apps.agents.explainability_agent.tasks as ea
import apps.agents.alert_agent.tasks as aa
import apps.agents.orchestrator_agent.workflow as oa
import apps.agents.chat_router_agent.router as cra
from apps.agents.chat_router_agent.models import ChatSession, ChatMessage
from django.contrib.auth.models import User
from apps.digital_twin.models import CityZone, FloodPrediction, TwinState, TwinCognitionLog

print("TASK SIGNATURES:")
print("1. Sensing:", inspect.signature(sa.run_sensing_agent))
print("2. Prediction:", inspect.signature(pa.run_prediction_agent))
print("3. Simulation:", inspect.signature(sia.run_simulation_agent))
print("4. Explainability:", inspect.signature(ea.run_explainability_agent))
print("5. Alert:", inspect.signature(aa.run_alert_agent))
print("6. Orchestrator:", inspect.signature(oa.run_cognitive_cycle_task))
print("7. Chat Router process_message:", inspect.signature(cra.ChatRouter.process_message))

zone = CityZone.objects.first()
if not zone:
    zone = CityZone.objects.create(
        name="Velachery Core",
        city="Chennai",
        center_lat=12.9750,
        center_lng=80.2200,
        elevation_avg=4.5,
        drainage_capacity_index=0.5,
        criticality="normal"
    )

print(f"\n=======================================================")
print(f"--- 2.3: TESTING AGENT 1 (Sensing) on Zone {zone.id} ---")
s_out = sa.run_sensing_agent(zone.id, fused_mode=False, cycle_id="test_cycle_001")
print("Sensing Output Keys:", list(s_out.keys()))
print(f"Rainfall: {s_out.get('rainfall_mm')} mm/hr, SAR: {s_out.get('sar_source')}, Sensor: {s_out.get('water_level_sensor_m')}m")
assert 'rainfall_mm' in s_out
assert 'sar_source' in s_out

print(f"\n--- 2.3: TESTING AGENT 2 (Prediction) on Zone {zone.id} ---")
p_out = pa.run_prediction_agent(zone.id, s_out)
print("Prediction Output Keys:", list(p_out.keys()))
print(f"Pred Depth: {p_out.get('predicted_depth_m')}m, Confidence: {p_out.get('confidence_score')}, Pred ID: {p_out.get('prediction_id')}")
assert 'predicted_depth_m' in p_out
assert 'confidence_score' in p_out
prediction_id = p_out['prediction_id']

print(f"\n--- 2.3: TESTING AGENT 3 (Simulation) on Zone {zone.id} ---")
sim_out = sia.run_simulation_agent(zone.id, p_out)
print("Simulation Output Keys:", list(sim_out.keys()))
print(f"Time series slices: {len(sim_out.get('time_series_slices', []))}, Next Heightmap Grid rows: {len(sim_out.get('immediate_next_heightmap', []))}")
assert 'immediate_next_heightmap' in sim_out
assert 'time_series_slices' in sim_out

print(f"\n--- 2.3: TESTING AGENT 4 (Explainability) on Pred #{prediction_id} ---")
xai_out = ea.run_explainability_agent(prediction_id)
print("Explainability Output Keys:", list(xai_out.keys()))
print(f"Grad-CAM Path: {xai_out.get('explanation_image_path')}")
print(f"Summary: {xai_out.get('explanation_summary')[:120]}...")
assert 'explanation_summary' in xai_out

print(f"\n--- 2.3: TESTING AGENT 5 (Alert) on Pred #{prediction_id} ---")
alert_out = aa.run_alert_agent(prediction_id)
print("Alert Output Keys:", list(alert_out.keys()))
print(f"Decision: {alert_out.get('decision')}, Severity: {alert_out.get('severity')}, Reasoning: {alert_out.get('reasoning')[:80]}...")
assert 'decision' in alert_out
assert 'severity' in alert_out

print(f"\n--- 2.3: TESTING AGENT 7 (Chat Router) ---")
test_user, _ = User.objects.get_or_create(username="test_officer")
test_session = ChatSession.objects.filter(user=test_user, zone_context=zone).first()
if not test_session:
    test_session = ChatSession.objects.create(user=test_user, zone_context=zone)
router = cra.ChatRouter(user=test_user, session=test_session, language="en")
chat_out = router.process_message(f"What is the flood status in {zone.name}?")
print("Chat Router Output Keys:", list(chat_out.keys()))
print("Tools called:", chat_out.get('tool_calls_made'))
print("Agent Response Preview:", chat_out.get('content', '')[:200])
assert 'content' in chat_out

print(f"\n=======================================================")
print(f"--- 2.4: FULL ORCHESTRATOR COGNITIVE CYCLE (End-to-End) ---")
cycle_result = oa.run_cognitive_cycle_task(zone.id)
print("Orchestrator Cycle Result:", cycle_result)
assert 'cycle_id' in cycle_result
assert 'predicted_depth_m' in cycle_result

# Trace TwinCognitionLog entries produced
cycle_id = cycle_result.get('cycle_id')
print(f"\nTracing TwinCognitionLog entries for cycle_id={cycle_id}:")
logs = TwinCognitionLog.objects.filter(cycle_id=cycle_id).order_by('timestamp')
if not logs.exists():
    logs = TwinCognitionLog.objects.filter(zone=zone).order_by('-timestamp')[:10]

for log in logs:
    print(f"  [{log.timestamp.strftime('%H:%M:%S')}] Agent: {log.agent_name:<20} | Status: {log.status:<8} | Action: {log.action_taken}")
    print(f"     Reasoning: {log.reasoning_text[:110]}...")

print("\n>>> ALL 7 CELERY AGENT TASKS AND ORCHESTRATOR COGNITIVE CYCLE VERIFIED WITH REAL OUTPUT <<<")
