from django.test import TestCase
from django.db import IntegrityError
from django.db.models import ProtectedError
from apps.digital_twin.models import CityZone, TwinState, TwinCognitionLog, FloodPrediction, InfrastructureRiskFlag
from apps.digital_twin.serializers import FloodPredictionSerializer, TwinStateSerializer

class DigitalTwinModelsTestCase(TestCase):
    def setUp(self):
        self.zone = CityZone.objects.create(
            name="Test Zone Alpha",
            city="Chennai",
            elevation_avg=5.5,
            criticality="hospital",
            center_lat=13.0,
            center_lng=80.2,
            drainage_capacity_index=0.5
        )

    def test_city_zone_creation_and_defaults(self):
        self.assertEqual(self.zone.name, "Test Zone Alpha")
        self.assertEqual(self.zone.city, "Chennai")
        self.assertEqual(self.zone.criticality, "hospital")
        # Test unique constraint on name
        with self.assertRaises(IntegrityError):
            CityZone.objects.create(name="Test Zone Alpha")

    def test_twin_state_protect_behavior(self):
        ts = TwinState.objects.create(
            zone=self.zone,
            rainfall_mm=10.5,
            current_confidence=0.9
        )
        self.assertEqual(ts.zone, self.zone)
        # Verify PROTECT behavior
        with self.assertRaises(ProtectedError):
            self.zone.delete()

    def test_flood_prediction_serializer_round_trip(self):
        pred = FloodPrediction.objects.create(
            zone=self.zone,
            predicted_depth_m=1.2,
            confidence_score=0.85,
            is_fused_prediction=True,
            primary_sar_source='sentinel1'
        )
        # Serialize
        serializer = FloodPredictionSerializer(pred)
        data = serializer.data
        self.assertEqual(data['predicted_depth_m'], 1.2)
        self.assertEqual(data['primary_sar_source'], 'sentinel1')
        self.assertEqual(data['zone'], self.zone.id)
        
    def test_twin_cognition_log_creation(self):
        log = TwinCognitionLog.objects.create(
            zone=self.zone,
            agent_name="Test Agent",
            action_taken="Tested things",
            reasoning_text="Reasoning",
            status="info"
        )
        self.assertEqual(log.agent_name, "Test Agent")
        
    def test_infrastructure_risk_flag_creation(self):
        flag = InfrastructureRiskFlag.objects.create(
            zone=self.zone,
            risk_score=0.9,
            primary_bottleneck="Drain",
            recommended_upgrade="Bigger drain"
        )
        self.assertEqual(flag.risk_score, 0.9)
