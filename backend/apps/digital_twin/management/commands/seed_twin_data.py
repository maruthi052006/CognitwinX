import random
import math
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from apps.users.models import UserProfile
from apps.digital_twin.models import CityZone, TwinState, TwinCognitionLog, FloodPrediction
from apps.alerts.models import Alert, AgentDecisionLog
from apps.agents.simulation_agent.heightmap_generator import generate_depth_grid

def generate_synthetic_buildings(zone_name: str, zone_type: str) -> dict:
    """
    Generates realistic 3D building footprint GeoJSON for Three.js extrusion.
    Coordinates are in local meter offsets [-90, +90] relative to zone center.
    """
    random.seed(abs(hash(zone_name)) % 10000)
    features = []
    building_id = 1

    # Grid layout of blocks
    for bx in range(-4, 5):
        for by in range(-4, 5):
            # Leave gaps for roads and natural drain canals
            if abs(by) == 0:  # Primary east-west stormwater drain canal corridor
                continue
            if abs(bx) == 2 or abs(by) == 2:  # Arterial avenues
                continue

            cx = bx * 20.0 + random.uniform(-2.5, 2.5)
            cy = by * 20.0 + random.uniform(-2.5, 2.5)
            w = random.uniform(8.0, 14.0)
            d = random.uniform(8.0, 14.0)

            # Assign building typology
            if bx == -3 and by == 3 and zone_type == 'hospital':
                b_type = 'hospital'
                b_name = f"{zone_name} Multi-Specialty Hospital"
                height = 24.0
            elif bx == 3 and by == -3 and zone_type == 'school':
                b_type = 'school'
                b_name = f"{zone_name} Public Higher Secondary School"
                height = 12.0
            elif abs(bx) <= 1 and abs(by) <= 1:
                b_type = 'commercial'
                b_name = f"Metro Tech Tower {building_id}"
                height = random.uniform(22.0, 42.0)
            else:
                b_type = 'residential'
                b_name = f"Apartments Block {chr(65 + (building_id % 26))}"
                height = random.uniform(10.0, 20.0)

            # 4-corner polygon
            poly = [
                [cx - w/2, cy - d/2],
                [cx + w/2, cy - d/2],
                [cx + w/2, cy + d/2],
                [cx - w/2, cy + d/2],
                [cx - w/2, cy - d/2]
            ]

            features.append({
                "type": "Feature",
                "properties": {
                    "id": f"bldg_{building_id}",
                    "name": b_name,
                    "type": b_type,
                    "x": cx,
                    "y": cy,
                    "width": w,
                    "depth": d,
                    "height": round(height, 1),
                    "base_elevation": round(random.uniform(0.1, 0.8), 2)
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [poly]
                }
            })
            building_id += 1

    return {
        "type": "FeatureCollection",
        "features": features
    }


class Command(BaseCommand):
    help = 'Seeds initial Indian urban flood zones, building footprints, cognition logs, and demo users.'

    def handle(self, *args, **options):
        self.stdout.write("Seeding CognitwinX database...")

        # 1. Create Default Roles / Users
        users_data = [
            ('admin', 'admin@cognitwin.gov.in', 'admin123', 'admin', 'Disaster Management Authority'),
            ('ndma_officer', 'officer@ndma.gov.in', 'officer123', 'ndma_officer', 'National Disaster Management Authority'),
            ('viewer', 'viewer@public.in', 'viewer123', 'public_viewer', 'Citizen Portal'),
        ]

        for username, email, pwd, role, agency in users_data:
            user, created = User.objects.get_or_create(username=username, defaults={'email': email})
            if created:
                user.set_password(pwd)
                user.save()
            profile, _ = UserProfile.objects.get_or_create(user=user)
            profile.role = role
            profile.agency = agency
            profile.save()
            self.stdout.write(f"  User verified: {username} ({role})")

        # 2. Seed City Zones
        zones_seed = [
            {
                'name': 'Velachery - Madipakkam Basin',
                'city': 'Chennai',
                'elevation_avg': 7.5,
                'criticality': 'hospital',
                'center_lat': 12.9784,
                'center_lng': 80.2184,
                'drainage_capacity_index': 0.42,  # Constricted Pallikaranai marsh outlet
            },
            {
                'name': 'Bellandur - ORR Tech Corridor',
                'city': 'Bengaluru',
                'elevation_avg': 872.0,
                'criticality': 'critical_infra',
                'center_lat': 12.9260,
                'center_lng': 77.6762,
                'drainage_capacity_index': 0.50,  # Varthur lake bottleneck
            },
            {
                'name': 'Kurla West - Mithi River Confluence',
                'city': 'Mumbai',
                'elevation_avg': 5.8,
                'criticality': 'hospital',
                'center_lat': 19.0688,
                'center_lng': 72.8797,
                'drainage_capacity_index': 0.35,  # Tidal lock sensitivity
            },
            {
                'name': 'Old City - Musi River Basin',
                'city': 'Hyderabad',
                'elevation_avg': 505.0,
                'criticality': 'school',
                'center_lat': 17.3616,
                'center_lng': 78.4747,
                'drainage_capacity_index': 0.58,  # Storm nallah encroachment
            },
        ]

        for z_data in zones_seed:
            footprints = generate_synthetic_buildings(z_data['name'], z_data['criticality'])
            zone, created = CityZone.objects.update_or_create(
                name=z_data['name'],
                defaults={
                    'city': z_data['city'],
                    'elevation_avg': z_data['elevation_avg'],
                    'criticality': z_data['criticality'],
                    'center_lat': z_data['center_lat'],
                    'center_lng': z_data['center_lng'],
                    'drainage_capacity_index': z_data['drainage_capacity_index'],
                    'building_footprints_geojson': footprints,
                    'boundary': {
                        "type": "Polygon",
                        "coordinates": [[
                            [z_data['center_lng'] - 0.012, z_data['center_lat'] - 0.012],
                            [z_data['center_lng'] + 0.012, z_data['center_lat'] - 0.012],
                            [z_data['center_lng'] + 0.012, z_data['center_lat'] + 0.012],
                            [z_data['center_lng'] - 0.012, z_data['center_lat'] + 0.012],
                            [z_data['center_lng'] - 0.012, z_data['center_lat'] - 0.012],
                        ]]
                    }
                }
            )

            # 3. Seed TwinState
            rainfall = 38.0 if zone.city in ['Chennai', 'Mumbai'] else 22.5
            TwinState.objects.create(
                zone=zone,
                rainfall_mm=rainfall,
                sar_image_path=f"sar_vh_{zone.id}.tif",
                current_confidence=0.89,
                fused_mode=True,
                water_level_sensor_m=round(rainfall * 0.025, 2)
            )

            # 4. Seed FloodPrediction with 64x64 Depth Heightmap
            depth = 0.65 if zone.city == 'Chennai' else (0.78 if zone.city == 'Mumbai' else 0.32)
            grid = generate_depth_grid(base_depth=depth, rainfall_factor=1.1, drainage_factor=zone.drainage_capacity_index, hour=2, grid_size=64)

            # Building importance scores for Explanation View
            building_scores = {f"bldg_{i}": round(random.uniform(0.15, 0.95), 2) for i in range(1, 55)}

            pred = FloodPrediction.objects.create(
                zone=zone,
                predicted_depth_m=depth,
                confidence_score=0.91,
                depth_heightmap_grid=grid,
                feature_importance_scores={'building_scores': building_scores, 'top_driver': 'Low Basin Elevation + Primary Canal Inundation'},
                explanation_summary=(
                    f"Attention U-Net detected 88% flood probability concentrated in {zone.name} "
                    f"primary drainage corridor. High rainfall intensity ({rainfall}mm/hr) and low elevation ({zone.elevation_avg}m) "
                    f"drive peak inundation of {depth}m."
                ),
                is_fused_prediction=True
            )

            # 5. Seed TwinCognitionLog chain (demonstrating the autonomous multi-agent reasoning trail)
            cycle_id = f"cycle_{random.randint(1000, 9999)}"
            logs = [
                ('Sensing Agent', 'Ingesting Multi-Sensor Telemetry', f'Queried Sentinel-1 SAR (VH) backscatter for {zone.name}. IMD AWS rainfall logged at {rainfall}mm/hr.', 'info'),
                ('Prediction Agent', 'Attention U-Net Inference', 'First-pass segmentation confidence computed at 0.54 (ambiguous urban speckle detected).', 'info'),
                ('Orchestrator Agent', 'Cognitive Self-Correction Triggered', 'Confidence 0.54 < 0.60 threshold. Autonomous decision: requesting fused Sentinel-2 optical NDWI imagery.', 'retry'),
                ('Sensing Agent', 'Ingesting Fused SAR + Optical NDWI', 'Acquired Sentinel-2 multispectral Green/NIR bands. Fused NDWI with SAR backscatter.', 'info'),
                ('Prediction Agent', 'Re-segmentation with Fused Data', 'Attention U-Net re-inference completed. Confidence boosted to 0.91 (+37%). Flood depth estimated at 0.65m.', 'success'),
                ('Simulation Agent', 'Kinematic Wave Projection', 'Generated 64x64 depth heightmap time series for hours T+1h through T+6h.', 'info'),
                ('Explainability Agent', 'Grad-CAM Saliency Attribution', 'Grad-CAM heatmaps highlight 82% attribution at the low-elevation canal intersection.', 'info'),
                ('Alert Agent', 'Emergency Threshold Evaluated', f"Triggered autonomous alert: Depth {depth}m in {zone.get_criticality_display()} zone.", 'escalate' if depth > 0.6 else 'info'),
            ]

            for agent, action, reasoning, st in logs:
                TwinCognitionLog.objects.create(
                    zone=zone,
                    cycle_id=cycle_id,
                    agent_name=agent,
                    action_taken=action,
                    reasoning_text=reasoning,
                    status=st
                )

            # 6. Seed Alerts
            if depth >= 0.40:
                sev = 'critical' if zone.criticality in ['hospital', 'critical_infra'] or depth > 0.7 else 'high'
                alert = Alert.objects.create(
                    zone=zone,
                    prediction=pred,
                    severity=sev,
                    message=f"[NDMA/COGNITWIN {sev.upper()}] Flood inundation {depth}m in {zone.name} ({zone.city}). Autonomous alert sent.",
                    sms_sent=True,
                    acknowledged=False
                )
                AgentDecisionLog.objects.create(
                    prediction=pred,
                    decision='alert' if sev != 'critical' else 'escalate',
                    reasoning_text=f"Depth {depth}m in {zone.criticality} zone exceeded safety margins. Dispatched SMS."
                )

            self.stdout.write(f"  Zone seeded: {zone.name} with 3D buildings & prediction")

        self.stdout.write(self.style.SUCCESS("CognitwinX database successfully seeded with all Indian urban zones!"))
