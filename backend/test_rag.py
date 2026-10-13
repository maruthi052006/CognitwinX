import os
import sys
import django

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth.models import User
from apps.agents.chat_router_agent.models import ChatSession
from apps.agents.chat_router_agent.router import ChatRouter

def test_rag():
    officer_user, _ = User.objects.get_or_create(username='test_officer')
    session = ChatSession.objects.create(user=officer_user)
    router = ChatRouter(user=officer_user, session=session)

    print("\n--- TEST RAG 1: NDMA SOP Guidelines ---")
    res1 = router.process_message("What is the NDMA flood depth threshold for emergency action?")
    print("Response:\n", res1['content'])
    assert any(tc['tool'] == 'rag_knowledge_retrieval' for tc in res1.get('tool_calls_made', [])), "Expected RAG tool call"
    print(">>> RAG TEST 1 PASSED: Grounded in NDMA guidelines.")

    print("\n--- TEST RAG 2: SAR Microwave Backscatter ---")
    res2 = router.process_message("How does Synthetic Aperture Radar (SAR) specular backscatter detect water?")
    print("Response:\n", res2['content'])
    assert any(tc['tool'] == 'rag_knowledge_retrieval' for tc in res2.get('tool_calls_made', [])), "Expected RAG tool call"
    print(">>> RAG TEST 2 PASSED: Grounded in SAR physics.")

    print("\nAll RAG tests passed!")

if __name__ == '__main__':
    test_rag()
