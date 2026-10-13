from django.utils import timezone
from rest_framework import generics, status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from .models import Alert, AgentDecisionLog
from .serializers import AlertSerializer, AgentDecisionLogSerializer
from apps.digital_twin.ws_broadcast import broadcast_twin_event

class AlertListCreateView(generics.ListCreateAPIView):
    queryset = Alert.objects.all().select_related('zone', 'acknowledged_by')
    serializer_class = AlertSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            # Only admins can manually broadcast alerts via API
            return [permissions.IsAdminUser()]
        return super().get_permissions()

    def perform_create(self, serializer):
        alert = serializer.save()
        # Broadcast via WebSockets
        broadcast_twin_event('alert_event', {
            'id': alert.id,
            'zone_id': alert.zone_id,
            'zone_name': alert.zone.name,
            'severity': alert.severity,
            'message': alert.message,
            'sent_at': alert.sent_at.isoformat(),
            'acknowledged': False
        })

class AlertAcknowledgeView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, pk):
        return self.patch(request, pk)

    def patch(self, request, pk):
        role = getattr(getattr(request.user, 'profile', None), 'role', None) or request.headers.get('X-User-Role', 'ndma_officer')
        if role not in ['admin', 'ndma_officer']:
            return Response({'error': 'Unauthorized to acknowledge alerts.'}, status=status.HTTP_403_FORBIDDEN)

        try:
            alert = Alert.objects.get(pk=pk)
        except Alert.DoesNotExist:
            return Response({'error': 'Alert not found'}, status=status.HTTP_404_NOT_FOUND)

        alert.acknowledged = True
        alert.acknowledged_at = timezone.now()
        alert.acknowledged_by = request.user if (request.user and request.user.is_authenticated) else None
        alert.save()

        # Broadcast acknowledgment to update frontend HUD
        broadcast_twin_event('alert_acknowledged', {
            'id': alert.id,
            'acknowledged': True,
            'acknowledged_at': alert.acknowledged_at.isoformat(),
        })

        return Response(AlertSerializer(alert).data)

class AgentDecisionLogListView(generics.ListAPIView):
    queryset = AgentDecisionLog.objects.all().select_related('prediction')
    serializer_class = AgentDecisionLogSerializer
