from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from django.shortcuts import get_object_or_404
from apps.digital_twin.models import CityZone
from .workflow import execute_cognitive_cycle

class RunCognitiveCycleView(APIView):
    permission_classes = [permissions.AllowAny]
    """
    On-demand API endpoint to trigger a full autonomous cognitive cycle
    for a chosen zone. Useful for real-time demonstrations and tests.
    """
    def post(self, request):
        zone_id = request.data.get('zone_id')
        if not zone_id:
            return Response({'error': 'zone_id parameter is required.'}, status=status.HTTP_400_BAD_REQUEST)
        
        zone = get_object_or_404(CityZone, pk=zone_id)

        result = execute_cognitive_cycle(zone_id=zone.id)
        return Response(result, status=status.HTTP_200_OK)
