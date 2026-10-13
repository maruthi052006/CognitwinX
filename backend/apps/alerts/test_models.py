from django.test import TestCase
from django.db import IntegrityError
from django.db.models import ProtectedError
from apps.digital_twin.models import CityZone, FloodPrediction
from apps.alerts.models import Alert, AgentDecisionLog
from apps.alerts.serializers import AlertSerializer, AgentDecisionLogSerializer

class AlertsModelsTestCase(TestCase):
    def setUp(self):
        self.zone = CityZone.objects.create(
            name="Alert Test Zone",
            city="Chennai",
            elevation_avg=4.5,
            criticality="school",
            center_lat=13.1,
            center_lng=80.3,
            drainage_capacity_index=0.4
        )
        self.prediction = FloodPrediction.objects.create(
            zone=self.zone,
            predicted_depth_m=0.8,
            confidence_score=0.9
        )

    def test_alert_protect_behavior(self):
        alert = Alert.objects.create(
            zone=self.zone,
            prediction=self.prediction,
            severity='high',
            message='High flood warning',
            target_recipients='Ward 12 Office'
        )
        self.assertEqual(alert.zone, self.zone)
        # Verify PROTECT behavior
        with self.assertRaises(ProtectedError):
            self.zone.delete()

    def test_alert_serializer_round_trip(self):
        alert = Alert.objects.create(
            zone=self.zone,
            prediction=self.prediction,
            severity='critical',
            message='Evacuate immediately',
            target_recipients='NDMA'
        )
        # Serialize
        serializer = AlertSerializer(alert)
        data = serializer.data
        self.assertEqual(data['severity'], 'critical')
        self.assertEqual(data['message'], 'Evacuate immediately')
        self.assertEqual(data['zone'], self.zone.id)
        
    def test_agent_decision_log_creation_and_serializer(self):
        log = AgentDecisionLog.objects.create(
            prediction=self.prediction,
            decision='escalate',
            reasoning_text='High depth detected'
        )
        self.assertEqual(log.decision, 'escalate')
        
        # Serialize
        serializer = AgentDecisionLogSerializer(log)
        data = serializer.data
        self.assertEqual(data['decision'], 'escalate')
        self.assertEqual(data['reasoning_text'], 'High depth detected')
        self.assertEqual(data['prediction'], self.prediction.id)
