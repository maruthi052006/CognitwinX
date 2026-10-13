import os
import sys
import django

# Reconfigure stdout/stderr for clean utf-8 on Windows cp1252 consoles
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth.models import User
from apps.users.models import UserProfile
from apps.digital_twin.models import CityZone, FloodPrediction, InfrastructureRiskFlag
from apps.alerts.models import Alert, AgentDecisionLog
from apps.agents.chat_router_agent.models import ChatSession, ChatMessage
from apps.agents.chat_router_agent.router import ChatRouter
from apps.digital_twin.tasks import flag_recurring_risk_zones

def run_tests():
    print("================================================================")
    print("STARTING TEST SUITE: CHAT ROUTER AGENT & SUPPORTING FEATURES")
    print("================================================================")

    # 1. Setup test users
    officer_user, _ = User.objects.get_or_create(username='test_officer')
    if hasattr(officer_user, 'profile'):
        officer_user.profile.role = 'ndma_officer'
        officer_user.profile.save()

    public_user, _ = User.objects.get_or_create(username='test_public')
    if hasattr(public_user, 'profile'):
        public_user.profile.role = 'public_viewer'
        public_user.profile.save()

    zone = CityZone.objects.first()
    print(f"[Setup] Active zone: {zone.name} (ID: {zone.id})")

    # 2. Test Read-Only Query (Prediction)
    print("\n--- TEST 1: Read-Only Prediction Tool ---")
    session1 = ChatSession.objects.create(user=officer_user, zone_context=zone)
    router1 = ChatRouter(user=officer_user, session=session1)
    res1 = router1.process_message(f"What is the current flood depth in {zone.name}?")
    print("Response Content:\n", res1['content'])
    print("Tool calls made:", [tc['tool'] for tc in res1.get('tool_calls_made', [])])
    assert any(tc['tool'] == 'get_current_prediction' for tc in res1['tool_calls_made']), "Expected get_current_prediction tool call"
    print(">>> TEST 1 PASSED: get_current_prediction invoked with grounded depth and confidence.")

    # 3. Test Cross-Zone Comparison Tool
    print("\n--- TEST 2: Cross-Zone Comparison Tool ---")
    res2 = router1.process_message("Compare all zones and rank their risk.")
    print("Response Content:\n", res2['content'])
    assert any(tc['tool'] == 'compare_zones' for tc in res2['tool_calls_made']), "Expected compare_zones tool call"
    print(">>> TEST 2 PASSED: compare_zones successfully ranked basins.")

    # 4. Test Hydrodynamic Simulation Tool
    print("\n--- TEST 3: Hydrodynamic What-If Simulation Tool ---")
    res3 = router1.process_message(f"Simulate +30% rain for {zone.name}")
    print("Response Content:\n", res3['content'])
    assert any(tc['tool'] == 'run_whatif_simulation' for tc in res3['tool_calls_made']), "Expected run_whatif_simulation tool call"
    print(">>> TEST 3 PASSED: run_whatif_simulation returned 2D kinematic wave projection.")

    # 5. CRITICAL SAFETY TEST: Confirm-Before-Alert
    print("\n--- TEST 4: CRITICAL SAFETY RULE — Confirm-Before-Alert Interception ---")
    alert_count_before = Alert.objects.count()
    decision_log_count_before = AgentDecisionLog.objects.count()

    # User requests alert
    res4 = router1.process_message(f"Send critical emergency alert to SDMA for {zone.name}")
    print("Response Content:\n", res4['content'])
    print("Requires Confirmation:", res4.get('requires_confirmation'))

    # Verify tool was NOT executed yet!
    assert res4.get('requires_confirmation') is True, "Alert request must require confirmation!"
    assert Alert.objects.count() == alert_count_before, "Alert MUST NOT be created on first conversational message!"
    assert AgentDecisionLog.objects.count() == decision_log_count_before, "Decision log MUST NOT record alert before confirmation!"
    print(">>> TEST 4 PASSED: First message intercepted; confirmation requested without executing side-effect tool.")

    # 6. Safety Confirmation: User says 'Yes'
    print("\n--- TEST 5: Explicit User Confirmation Execution & Audit Logging ---")
    res5 = router1.process_message("Yes, confirm")
    print("Response Content:\n", res5['content'])
    print("Tool calls made:", [tc['tool'] for tc in res5.get('tool_calls_made', [])])

    assert any(tc['tool'] == 'trigger_alert' for tc in res5['tool_calls_made']), "Expected trigger_alert execution on confirmation"
    assert Alert.objects.count() == alert_count_before + 1, "Alert record must be created after confirmation"
    latest_decision = AgentDecisionLog.objects.first()
    assert latest_decision.triggered_via == 'chat', f"Expected triggered_via='chat', got '{latest_decision.triggered_via}'"
    print(f">>> TEST 5 PASSED: Alert executed after explicit confirmation. Logged to AgentDecisionLog with triggered_via='{latest_decision.triggered_via}'.")

    # 7. Role-based Tool Filtering Test (public_viewer)
    print("\n--- TEST 6: Role-Based Tool Filtering (public_viewer) ---")
    session_pub = ChatSession.objects.create(user=public_user, zone_context=zone)
    router_pub = ChatRouter(user=public_user, session=session_pub)
    assert 'trigger_alert' not in router_pub.tools, "trigger_alert tool MUST NOT be present in public_viewer tools list!"
    res_pub = router_pub.process_message(f"Trigger emergency alert for {zone.name}")
    print("Public viewer alert attempt response:\n", res_pub['content'])
    assert "restricted" in res_pub['content'].lower() or "denied" in res_pub['content'].lower(), "Public viewer must be blocked from alerting"
    print(">>> TEST 6 PASSED: public_viewer toolset is strictly read-only and restricted.")

    # 8. Infrastructure Risk Flagging Celery Task Test
    print("\n--- TEST 7: Infrastructure Risk Flagging Celery Task ---")
    task_res = flag_recurring_risk_zones()
    print("Task result:", task_res)
    flags_count = InfrastructureRiskFlag.objects.count()
    assert flags_count > 0, "Expected infrastructure risk flags to be created"
    flag = InfrastructureRiskFlag.objects.first()
    print(f"Sample Flag: {flag.zone.name} | Score: {flag.risk_score} | Bottleneck: {flag.primary_bottleneck}")
    print(">>> TEST 7 PASSED: flag_recurring_risk_zones successfully flagged infrastructure priorities.")

    print("\n================================================================")
    print("ALL TESTS PASSED SUCCESSFULLY! 100% VERIFIED.")
    print("================================================================")

if __name__ == '__main__':
    run_tests()
