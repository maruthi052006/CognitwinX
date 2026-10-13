from django.urls import path
from .views import (
    ZoneListView, ZoneDetailView, ZoneTwinStateView,
    LatestPredictionsView, PredictionExplainView,
    ZoneHistoryView, WhatIfSimulateView, TwinCognitionLogListView,
    ZoneSatelliteTileView, ZoneHistoricalReplayView,
    InfrastructureRiskFlagListView, ZoneRiskComparisonView,
    BhuvanCapabilitiesView, BhuvanWMSProxyView, ZoneLiveWeatherView
)


urlpatterns = [
    path('zones/', ZoneListView.as_view(), name='zone_list'),
    path('zones/comparison/', ZoneRiskComparisonView.as_view(), name='zone_comparison'),
    path('zones/bhuvan/capabilities/', BhuvanCapabilitiesView.as_view(), name='bhuvan_capabilities'),
    path('zones/bhuvan/wms/', BhuvanWMSProxyView.as_view(), name='bhuvan_wms_proxy'),
    path('zones/<int:pk>/', ZoneDetailView.as_view(), name='zone_detail'),
    path('zones/<int:pk>/weather/', ZoneLiveWeatherView.as_view(), name='zone_live_weather'),
    path('zones/<int:pk>/satellite-tile/', ZoneSatelliteTileView.as_view(), name='zone_satellite_tile'),
    path('zones/<int:pk>/twin-state/', ZoneTwinStateView.as_view(), name='zone_twin_state'),

    path('zones/<int:pk>/history/', ZoneHistoryView.as_view(), name='zone_history'),
    path('zones/<int:pk>/replay/', ZoneHistoricalReplayView.as_view(), name='zone_historical_replay'),
    path('predictions/latest/', LatestPredictionsView.as_view(), name='predictions_latest'),
    path('predictions/<int:pk>/explain/', PredictionExplainView.as_view(), name='prediction_explain'),
    path('simulate/what-if/', WhatIfSimulateView.as_view(), name='simulate_what_if'),
    path('agent/cognition-log/', TwinCognitionLogListView.as_view(), name='cognition_log_list'),
    path('infrastructure/risk-flags/', InfrastructureRiskFlagListView.as_view(), name='infrastructure_risk_flags'),
]


