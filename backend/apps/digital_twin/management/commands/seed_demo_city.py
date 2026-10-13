import random
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.contrib.auth.models import User
from apps.users.models import UserProfile
from apps.digital_twin.models import CityZone, TwinState, TwinCognitionLog, FloodPrediction, InfrastructureRiskFlag
from apps.alerts.models import Alert, AgentDecisionLog
from apps.digital_twin.mock_data import MockCityGenerator, MockFloodSimulator, generate_mock_cognition_entry

class Command(BaseCommand):
    help = 'Seeds realistic Indian demo cities with 1000+ buildings, flood predictions, and agent cognition logs.'

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("=== Starting CognitwinX Demo City Seeding (Mock Data Mode) ==="))

        # 1. Ensure Standard Evaluation Users Exist
        users_data = [
            ('admin', 'admin@cognitwin.gov.in', 'admin123', 'admin', 'Disaster Command Authority'),
            ('ndma_officer', 'officer@ndma.gov.in', 'officer123', 'ndma_officer', 'National Disaster Management Authority (NDMA)'),
            ('viewer', 'viewer@public.in', 'viewer123', 'public_viewer', 'Citizen Portal Viewer'),
        ]

        for username, email, pwd, role, agency in users_data:
            user, created = User.objects.get_or_create(
                username=username,
                defaults={'email': email, 'first_name': username.replace('_', ' ').title()}
            )
            if created:
                user.set_password(pwd)
                user.save()
            profile, _ = UserProfile.objects.get_or_create(
                user=user,
                defaults={'role': role, 'agency': agency}
            )
            profile.role = role
            profile.agency = agency
            profile.is_approved = True
            profile.save()

        self.stdout.write(self.style.SUCCESS("  [OK] Verified administrative and officer user credentials."))

        # 2. Define Demo Zones
        demo_zones = [
            {
                "name": "Velachery Demo Zone",
                "city": "Chennai",
                "center_lat": 12.9716,
                "center_lng": 80.2184,
                "elevation_avg": 6.8,
                "criticality": "hospital",
                "drainage_capacity_index": 0.45,
                "seed": 42,
                "rainfall_mm": 54.0,
                "bottleneck": "Pallikaranai Marshland Outflow Siltation & Velachery Main Drain Choke",
                "upgrade": "Construct 4.2m box culvert connecting Velachery Lake bypass canal to Buckingham canal."
            },
            {
                "name": "Bellandur Demo Zone",
                "city": "Bengaluru",
                "center_lat": 12.9352,
                "center_lng": 77.6784,
                "elevation_avg": 868.0,
                "criticality": "critical_infra",
                "drainage_capacity_index": 0.52,
                "seed": 108,
                "rainfall_mm": 38.5,
                "bottleneck": "Koramangala-Challaghatta Valley stormwater culvert overflow",
                "upgrade": "Desilt and reinforce storm outlet conduits along Outer Ring Road Tech Corridor."
            },
            {
                "name": "Dharavi Demo Zone",
                "city": "Mumbai",
                "center_lat": 19.0402,
                "center_lng": 72.8550,
                "elevation_avg": 7.5,
                "criticality": "normal",
                "drainage_capacity_index": 0.38,
                "seed": 256,
                "rainfall_mm": 68.0,
                "bottleneck": "Mithi River backflow during high astronomical tide",
                "upgrade": "Install automated sluice floodgates and dual high-capacity 200 cusec dewatering pumps."
            }
        ]

        now = timezone.now()

        for z_data in demo_zones:
            zone_name = str(z_data["name"])
            city = str(z_data["city"])
            c_lat = float(z_data["center_lat"])
            c_lng = float(z_data["center_lng"])
            elev = float(z_data["elevation_avg"])
            crit = str(z_data["criticality"])
            drainage = float(z_data["drainage_capacity_index"])
            rain = float(z_data["rainfall_mm"])

            self.stdout.write(f"\n  Generating 1000-building synthetic twin for: {zone_name} ({city})...")

            # A. Generate 1000 Buildings with realistic grid layout
            generator = MockCityGenerator(
                center_lat=c_lat,
                center_lon=c_lng,
                zone_name=zone_name,
                city_radius_m=1200,
                num_buildings=1000,
                seed=int(z_data["seed"])
            )
            geojson_data = generator.generate_feature_collection()

            # B. Save or Update CityZone
            zone, created = CityZone.objects.get_or_create(
                name=zone_name,
                defaults={
                    "city": city,
                    "center_lat": c_lat,
                    "center_lng": c_lng,
                    "elevation_avg": elev,
                    "criticality": crit,
                    "drainage_capacity_index": drainage,
                    "building_footprints_geojson": geojson_data,
                    "building_data_last_updated": now,
                    "building_data_quality_report": {
                        "total_valid_buildings": len(geojson_data["features"]),
                        "sources_used": ["mock_synthetic_city_grid", "indian_urban_typology"],
                        "confidence_source": "type_heuristic",
                    }
                }
            )

            if not created:
                zone.city = city
                zone.center_lat = c_lat
                zone.center_lng = c_lng
                zone.elevation_avg = elev
                zone.criticality = crit
                zone.drainage_capacity_index = drainage
                zone.building_footprints_geojson = geojson_data
                zone.building_data_last_updated = now
                zone.building_data_quality_report = {
                    "total_valid_buildings": len(geojson_data["features"]),
                    "sources_used": ["mock_synthetic_city_grid", "indian_urban_typology"],
                    "confidence_source": "type_heuristic",
                }
                zone.save()

            self.stdout.write(f"    [OK] Ingested {len(geojson_data['features'])} building footprints into {zone.name}.")

            # C. Generate Simulation & Prediction with MockFloodSimulator
            simulator = MockFloodSimulator(grid_size=64, seed=int(z_data["seed"]))
            pred_data = simulator.generate_prediction(zone_id=zone.id, rainfall_mm=rain, is_fused=True)

            # Feature importance scores for 3D Explanation View
            feature_importance = {
                "rainfall_contribution": 0.62,
                "elevation_depression_contribution": 0.24,
                "drainage_saturation_contribution": 0.14,
                "building_scores": {
                    feat["id"]: round(random.uniform(0.15, 0.95), 3)
                    for feat in geojson_data["features"][:80]
                }
            }

            # Create TwinState
            twin_state = TwinState.objects.create(
                zone=zone,
                rainfall_mm=rain,
                sar_image_path=f"sar_eos4_{zone.city.lower()}.tif",
                current_confidence=pred_data["confidence_score"],
                fused_mode=True,
                water_level_sensor_m=round(pred_data["predicted_depth_m"] * 0.85, 2)
            )

            # Create FloodPrediction
            pred = FloodPrediction.objects.create(
                zone=zone,
                predicted_depth_m=pred_data["predicted_depth_m"],
                confidence_score=pred_data["confidence_score"],
                depth_heightmap_grid=pred_data["depth_heightmap_grid"],
                explanation_summary=(
                    f"Cognitive AI Model (Attention U-Net) estimated {pred_data['predicted_depth_m']}m peak flood depth "
                    f"with {int(pred_data['confidence_score']*100)}% confidence driven by convective rainfall "
                    f"({rain} mm/h) and low elevation basin drainage capacity ({zone.elevation_avg}m MSL)."
                ),
                feature_importance_scores=feature_importance,
                is_fused_prediction=True,
                primary_sar_source="eos4",
                isro_validation_score=0.892,
                flood_extent_geojson={
                    "type": "FeatureCollection",
                    "features": [
                        {
                            "type": "Feature",
                            "geometry": {
                                "type": "Polygon",
                                "coordinates": [[
                                    [zone.center_lng - 0.008, zone.center_lat - 0.008],
                                    [zone.center_lng + 0.008, zone.center_lat - 0.008],
                                    [zone.center_lng + 0.008, zone.center_lat + 0.008],
                                    [zone.center_lng - 0.008, zone.center_lat + 0.008],
                                    [zone.center_lng - 0.008, zone.center_lat - 0.008],
                                ]]
                            },
                            "properties": {
                                "depth_m": pred_data["predicted_depth_m"],
                                "confidence": pred_data["confidence_score"]
                            }
                        }
                    ]
                }
            )

            # D. Seed Historical Twin Cognition Logs
            agent_timeline = [
                ("Sensing", "SAR Radar Telemetry Ingested", "success", 90),
                ("Prediction", "Attention U-Net Deep Learning Inference", "info", 80),
                ("Orchestrator", "Multi-Sensor Quality Verification", "info", 70),
                ("Simulation", "Hydrodynamic Kinematic Wave Projection", "info", 50),
                ("Explainability", "Grad-CAM Attribution Mapping", "info", 40),
                ("Alert", "Emergency Dispatch Assessment", "success", 20),
            ]

            cycle_id = f"demo_cycle_{zone.id}_{random.randint(1000, 9999)}"
            for agent, action, status, minutes_ago in agent_timeline:
                reasoning = generate_mock_cognition_entry(
                    zone_name=zone.name,
                    agent_name=agent,
                    depth=pred.predicted_depth_m,
                    confidence=pred.confidence_score,
                    rainfall=rain
                )
                log = TwinCognitionLog.objects.create(
                    zone=zone,
                    cycle_id=cycle_id,
                    agent_name=f"{agent} Agent",
                    action_taken=action,
                    reasoning_text=reasoning,
                    status=status
                )
                # Stagger timestamp into the past
                log.timestamp = now - timedelta(minutes=minutes_ago)
                log.save(update_fields=['timestamp'])

            self.stdout.write(f"    [OK] Created {len(agent_timeline)} cognitive agent trail records.")

            # E. Seed Infrastructure Risk Flag
            InfrastructureRiskFlag.objects.get_or_create(
                zone=zone,
                defaults={
                    "risk_score": 0.82 if zone.criticality in ['hospital', 'critical_infra'] else 0.65,
                    "recurring_events_count": random.randint(2, 5),
                    "primary_bottleneck": str(z_data["bottleneck"]),
                    "recommended_upgrade": str(z_data["upgrade"]),
                    "resolved": False
                }
            )

            # F. Seed Disaster Alert if high rainfall
            if rain > 40.0:
                Alert.objects.get_or_create(
                    zone=zone,
                    defaults={
                        "prediction": pred,
                        "severity": "critical" if zone.criticality == "hospital" else "high",
                        "message": (
                            f"URGENT FLOOD ALERT: {zone.name} is experiencing severe inundation "
                            f"(projected peak: {pred.predicted_depth_m}m). Emergency response units and "
                            f"civil pumping stations are mobilized."
                        ),
                        "sms_sent": True,
                        "email_sent": True,
                        "acknowledged": False
                    }
                )

        self.stdout.write(self.style.SUCCESS("\n[SUCCESS] Demo city database seeded successfully with 1000-building synthetic digital twins!"))
