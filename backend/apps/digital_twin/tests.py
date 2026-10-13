import torch
from django.test import TestCase
from django.urls import reverse
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from apps.digital_twin.models import CityZone, FloodPrediction, TwinCognitionLog
from apps.agents.prediction_agent.ml_engine.attention_unet import AttentionUNet
from apps.agents.orchestrator_agent.workflow import execute_cognitive_cycle
from apps.agents.sensing_agent.services.bhoonidhi_client import BhoonidhiClient
from apps.agents.sensing_agent.services.nasa_earthdata_client import NASAEarthdataClient
from apps.agents.sensing_agent.services.bhuvan_client import BhuvanClient

class MultiAgentTwinTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.zone = CityZone.objects.create(
            name="Test Ward Chennai",
            city="Chennai",
            elevation_avg=8.0,
            criticality="hospital",
            center_lat=12.98,
            center_lng=80.22,
            drainage_capacity_index=0.45,
            building_footprints_geojson={"type": "FeatureCollection", "features": []}
        )

    def test_attention_unet_forward_tensor(self):
        """Verify Attention U-Net accepts (B, 1, 128, 128) and outputs (B, 1, 128, 128) in [0, 1]"""
        model = AttentionUNet(in_channels=1, out_channels=1)
        model.eval()
        dummy_input = torch.randn(2, 1, 128, 128)
        with torch.no_grad():
            output = model(dummy_input)
        self.assertEqual(output.shape, (2, 1, 128, 128))
        self.assertTrue(torch.all(output >= 0.0) and torch.all(output <= 1.0))

    def test_autonomous_cognitive_cycle_execution(self):
        """Verify the complete multi-agent cognitive loop executes with ISRO validation & provenance tracking"""
        result = execute_cognitive_cycle(zone_id=self.zone.id)
        self.assertEqual(result['zone_id'], self.zone.id)
        self.assertIn('predicted_depth_m', result)
        self.assertIn('confidence_score', result)
        self.assertIn('primary_sar_source', result)
        self.assertIn('isro_validation_score', result)
        self.assertGreater(result['isro_validation_score'], 0.5)

        # Verify prediction record in database
        pred = FloodPrediction.objects.filter(zone=self.zone).order_by('-timestamp').first()
        self.assertIsNotNone(pred)
        self.assertIn(pred.primary_sar_source, ['eos4', 'sentinel1'])
        self.assertIsNotNone(pred.isro_validation_score)

        # Verify logs were recorded for all agent lifecycle stages
        logs = TwinCognitionLog.objects.filter(zone=self.zone)
        agent_names = set(logs.values_list('agent_name', flat=True))
        expected_agents = {'Sensing Agent', 'Prediction Agent', 'Simulation Agent', 'Explainability Agent', 'Alert Agent', 'Orchestrator Agent'}
        for agent in expected_agents:
            self.assertIn(agent, agent_names)

    def test_api_endpoints_and_bhuvan_tile(self):
        """Verify REST API responses including Bhuvan satellite tile proxy"""
        res_zones = self.client.get('/api/zones/')
        self.assertEqual(res_zones.status_code, 200)

        res_latest = self.client.get('/api/predictions/latest/')
        self.assertEqual(res_latest.status_code, 200)

        # Test Bhuvan tile endpoint
        res_tile = self.client.get(f'/api/zones/{self.zone.id}/satellite-tile/')
        self.assertEqual(res_tile.status_code, 200)
        self.assertEqual(res_tile['Content-Type'], 'image/png')
        self.assertGreater(len(res_tile.content), 500)

    def test_nasa_earthdata_self_healing_fallback(self):
        """Verify NASA Earthdata IMERG client operates gracefully in simulated or token-expired fallback"""
        nasa_client = NASAEarthdataClient()
        # Test simulated / fallback ingestion without token crash
        precip = nasa_client.get_imerg_precipitation(
            lat=self.zone.center_lat,
            lng=self.zone.center_lng,
            zone=self.zone,
            fallback_rainfall_mm=16.8
        )
        self.assertIn('precipitation_rate_mm_hr', precip)
        self.assertIn('accumulated_rainfall_mm', precip)
        self.assertTrue(precip['is_fallback'])
        self.assertGreater(precip['accumulated_rainfall_mm'], 0)

    def test_isro_bhoonidhi_waterspread_iou(self):
        """Verify Bhoonidhi client fetches EOS-04 SAR, WaterSpread, and calculates IoU"""
        bhoonidhi = BhoonidhiClient()
        bbox = [80.20, 12.96, 80.24, 13.00]
        sar = bhoonidhi.fetch_latest_sar_scene(bbox=bbox, zone=self.zone)
        self.assertIsNotNone(sar)
        self.assertEqual(sar['dataset'], "EOS-04_SAR(MRS)_L2B")

        waterspread = bhoonidhi.fetch_waterspread_ground_truth(bbox=bbox, zone=self.zone)
        self.assertIn('geojson', waterspread)

        # Calculate IoU against itself or predicted extent
        iou = bhoonidhi.compute_iou(waterspread['geojson'], waterspread)
        self.assertGreaterEqual(iou, 0.70)
        self.assertLessEqual(iou, 1.0)

    def test_auth_registration_and_officer_approval(self):
        """Verify user registration with approval requirement for NDMA officers"""
        # Register public viewer -> auto-approved
        res_pub = self.client.post('/api/auth/register/', {
            'username': 'viewer1',
            'password': 'Password123!',
            'role': 'public_viewer'
        }, format='json')
        self.assertEqual(res_pub.status_code, 201)
        self.assertTrue(res_pub.data['is_approved'])

        # Register NDMA officer -> requires approval (is_approved=False)
        res_off = self.client.post('/api/auth/register/', {
            'username': 'officer1',
            'password': 'Password123!',
            'role': 'ndma_officer',
            'agency': 'NDMA National Operations',
            'phone_number': '+919876543210'
        }, format='json')
        self.assertEqual(res_off.status_code, 201)
        self.assertFalse(res_off.data['is_approved'])
        self.assertIn('warning', res_off.data)

        # Login test
        res_login = self.client.post('/api/auth/login/', {
            'username': 'officer1',
            'password': 'Password123!'
        }, format='json')
        self.assertEqual(res_login.status_code, 200)
        self.assertIn('access', res_login.data)
        self.assertFalse(res_login.data['is_approved'])

        # Admin creates and approves officer
        admin_user = User.objects.create_superuser('superadmin', 'admin@cognitwinx.gov.in', 'AdminPass123!')
        self.client.force_authenticate(user=admin_user)
        officer_user = User.objects.get(username='officer1')
        res_approve = self.client.post(f'/api/users/approve-officer/{officer_user.id}/')
        self.assertEqual(res_approve.status_code, 200)

        # Officer is now approved
        officer_user.profile.refresh_from_db()
        self.assertTrue(officer_user.profile.is_approved)
