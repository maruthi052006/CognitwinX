from rest_framework import serializers
from .models import Alert, AgentDecisionLog

class AlertSerializer(serializers.ModelSerializer):
    zone_name = serializers.ReadOnlyField(source='zone.name')
    zone_criticality = serializers.ReadOnlyField(source='zone.criticality')
    acknowledged_by_name = serializers.ReadOnlyField(source='acknowledged_by.username')

    class Meta:
        model = Alert
        fields = [
            'id', 'zone', 'zone_name', 'zone_criticality', 'prediction',
            'severity', 'message', 'sent_at', 'acknowledged',
            'acknowledged_by_name', 'acknowledged_at',
            'sms_sent', 'email_sent', 'target_recipients'
        ]

class AgentDecisionLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentDecisionLog
        fields = ['id', 'prediction', 'decision', 'reasoning_text', 'triggered_via', 'timestamp']

