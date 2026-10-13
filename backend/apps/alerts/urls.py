from django.urls import path
from .views import AlertListCreateView, AlertAcknowledgeView, AgentDecisionLogListView

urlpatterns = [
    path('alerts/', AlertListCreateView.as_view(), name='alert_list_create'),
    path('alerts/<int:pk>/acknowledge/', AlertAcknowledgeView.as_view(), name='alert_acknowledge'),
    path('alerts/decisions/', AgentDecisionLogListView.as_view(), name='alert_decisions'),
]
