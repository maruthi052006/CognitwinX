from django.urls import path
from .views import RunCognitiveCycleView

urlpatterns = [
    path('run-cycle/', RunCognitiveCycleView.as_view(), name='agent_run_cycle'),
    path('trigger-cycle/', RunCognitiveCycleView.as_view(), name='agent_trigger_cycle'),
]
