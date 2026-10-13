import json

with open('section1_summary.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

files = data['files']

# Group files by architectural subsystem
subsystems = {
    'Root Configuration & Orchestration': [],
    'Backend: Core Configuration & Setup': [],
    'Backend: Digital Twin Domain Core (Models, Views, Sockets)': [],
    'Backend: Agent 1 - Sensing Agent': [],
    'Backend: Agent 2 - Prediction Agent (Attention U-Net)': [],
    'Backend: Agent 3 - Simulation Agent (Kinematic Wave)': [],
    'Backend: Agent 4 - Explainability Agent (Grad-CAM/SHAP)': [],
    'Backend: Agent 5 - Alert Agent (CAP/SMS/Broadcast)': [],
    'Backend: Agent 6 - Orchestrator Agent (Cognitive Loop)': [],
    'Backend: Agent 7 - Conversational Router (Domain RAG)': [],
    'Backend: User Management & Role Gatekeeper': [],
    'Backend: Mock Telemetry & Synthetic Data Layer': [],
    'Backend: Tests & CLI Commands': [],
    'Backend: ML Training & Model Export Pipeline': [],
    'Frontend: Core Entry & Routing': [],
    'Frontend: Design System & Shared Layout': [],
    'Frontend: Mission Control Dashboard Components': [],
    'Frontend: 3D Cognitive Digital Twin & Shaders': [],
    'Frontend: Multi-Provider Geospatial Map Engine': [],
    'Frontend: Public Landing Page & Onboarding': [],
    'Frontend: State Management & API Services': [],
    'Frontend: Configuration & Tests': []
}

def classify_file(p):
    if p in ['docker-compose.yml', 'pyrightconfig.json', 'README.md', '.env.example']:
        return 'Root Configuration & Orchestration'
    if p.startswith('backend/config/'):
        return 'Backend: Core Configuration & Setup'
    if p.startswith('backend/apps/digital_twin/mock_data/'):
        return 'Backend: Mock Telemetry & Synthetic Data Layer'
    if p.startswith('backend/apps/digital_twin/management/') or p.startswith('backend/apps/digital_twin/tests') or p in ['backend/test_chat_router.py', 'backend/test_endpoints.py', 'backend/test_rag.py', 'backend/manage.py']:
        return 'Backend: Tests & CLI Commands'
    if p.startswith('backend/apps/digital_twin/'):
        return 'Backend: Digital Twin Domain Core (Models, Views, Sockets)'
    if p.startswith('backend/apps/agents/sensing_agent/'):
        return 'Backend: Agent 1 - Sensing Agent'
    if p.startswith('backend/apps/agents/prediction_agent/'):
        return 'Backend: Agent 2 - Prediction Agent (Attention U-Net)'
    if p.startswith('backend/apps/agents/simulation_agent/'):
        return 'Backend: Agent 3 - Simulation Agent (Kinematic Wave)'
    if p.startswith('backend/apps/agents/explainability_agent/'):
        return 'Backend: Agent 4 - Explainability Agent (Grad-CAM/SHAP)'
    if p.startswith('backend/apps/agents/alert_agent/'):
        return 'Backend: Agent 5 - Alert Agent (CAP/SMS/Broadcast)'
    if p.startswith('backend/apps/agents/orchestrator_agent/'):
        return 'Backend: Agent 6 - Orchestrator Agent (Cognitive Loop)'
    if p.startswith('backend/apps/agents/chat_router_agent/'):
        return 'Backend: Agent 7 - Conversational Router (Domain RAG)'
    if p.startswith('backend/apps/users/'):
        return 'Backend: User Management & Role Gatekeeper'
    if p.startswith('backend/ml_training/'):
        return 'Backend: ML Training & Model Export Pipeline'
    if p.startswith('backend/'):
        return 'Backend: Core Configuration & Setup'
    if p in ['frontend/src/App.jsx', 'frontend/src/main.jsx', 'frontend/src/index.css', 'frontend/index.html']:
        return 'Frontend: Core Entry & Routing'
    if p.startswith('frontend/src/components/layout/'):
        return 'Frontend: Design System & Shared Layout'
    if p.startswith('frontend/src/components/dashboard/') or p.startswith('frontend/src/components/simulator/'):
        return 'Frontend: Mission Control Dashboard Components'
    if p.startswith('frontend/src/components/3d/'):
        return 'Frontend: 3D Cognitive Digital Twin & Shaders'
    if p.startswith('frontend/src/components/map/'):
        return 'Frontend: Multi-Provider Geospatial Map Engine'
    if p.startswith('frontend/src/components/landing/') or p in ['frontend/src/pages/Login.jsx']:
        return 'Frontend: Public Landing Page & Onboarding'
    if p.startswith('frontend/src/components/chat/'):
        return 'Frontend: Mission Control Dashboard Components'
    if p.startswith('frontend/src/pages/'):
        return 'Frontend: Mission Control Dashboard Components'
    if p.startswith('frontend/src/store/') or p.startswith('frontend/src/services/') or p.startswith('frontend/src/context/'):
        return 'Frontend: State Management & API Services'
    if p.startswith('frontend/src/components/common/'):
        return 'Frontend: Design System & Shared Layout'
    return 'Frontend: Configuration & Tests'

for f in files:
    cat = classify_file(f['path'])
    subsystems[cat].append(f)

with open('scratch_subsystem_breakdown.json', 'w', encoding='utf-8') as out:
    json.dump(subsystems, out, indent=2)

print("Subsystem grouping complete.")
for k, v in subsystems.items():
    print(f"{k}: {len(v)} files")
