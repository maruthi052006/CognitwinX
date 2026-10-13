import os
from django.db import models
from django.conf import settings

# Geospatial field selection: PostGIS PolygonField if USE_POSTGIS is True, else GeoJSON JSONField
if getattr(settings, 'USE_POSTGIS', False):
    from django.contrib.gis.db import models as gis_models
    BoundaryField = gis_models.PolygonField(srid=4326, help_text="PostGIS Zone Boundary Polygon")
else:
    def get_boundary_field():
        return models.JSONField(
            default=dict,
            help_text="GeoJSON Polygon geometry {'type': 'Polygon', 'coordinates': [...]}"
        )

class CityZone(models.Model):
    CRITICALITY_CHOICES = [
        ('normal', 'Normal Residential / Commercial'),
        ('hospital', 'Hospital & Medical Center'),
        ('school', 'School & Educational Zone'),
        ('critical_infra', 'Critical Infrastructure (Power/Transit)'),
    ]

    CITY_CHOICES = [
        ('Chennai', 'Chennai'),
        ('Bengaluru', 'Bengaluru'),
        ('Mumbai', 'Mumbai'),
        ('Hyderabad', 'Hyderabad'),
    ]

    name = models.CharField(max_length=150, unique=True)
    city = models.CharField(max_length=50, choices=CITY_CHOICES, default='Chennai')
    
    if getattr(settings, 'USE_POSTGIS', False):
        from django.contrib.gis.db import models as gis_models
        boundary = gis_models.PolygonField(srid=4326, null=True, blank=True)
    else:
        boundary = models.JSONField(
            default=dict,
            help_text="GeoJSON Polygon geometry {'type': 'Polygon', 'coordinates': [...]}"
        )

    elevation_avg = models.FloatField(default=12.0, help_text="Average elevation in meters above sea level")
    criticality = models.CharField(max_length=30, choices=CRITICALITY_CHOICES, default='normal')
    building_footprints_geojson = models.JSONField(
        default=dict,
        help_text="FeatureCollection GeoJSON of building footprints with heights, footprints, and type"
    )
    center_lat = models.FloatField(default=12.9716)
    center_lng = models.FloatField(default=80.2184)
    drainage_capacity_index = models.FloatField(default=0.65, help_text="Normalized drainage efficiency 0.0-1.0")
    building_data_last_updated = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Timestamp of last building footprint ingestion"
    )
    building_data_quality_report = models.JSONField(
        default=dict,
        blank=True,
        help_text="Quality, provenance, and validation telemetry from BuildingIngestionPipeline"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.city}) - {self.get_criticality_display()}"


class TwinState(models.Model):
    zone = models.ForeignKey(CityZone, on_delete=models.PROTECT, related_name='twin_states')
    timestamp = models.DateTimeField(auto_now_add=True)
    rainfall_mm = models.FloatField(default=0.0, help_text="Current precipitation in mm/hr")
    sar_image_path = models.CharField(max_length=500, blank=True, default='')
    current_confidence = models.FloatField(default=0.85, help_text="Confidence of latest sensor ingestion/prediction")
    fused_mode = models.BooleanField(default=False, help_text="Whether fused SAR + Optical mode was activated")
    water_level_sensor_m = models.FloatField(default=0.0, help_text="IoT ultrasonic gauge reading if available")

    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['zone', '-timestamp']),
        ]

    def __str__(self):
        return f"{self.zone.name} @ {self.timestamp.strftime('%Y-%m-%d %H:%M')} (Rain: {self.rainfall_mm}mm, Conf: {self.current_confidence:.2f})"


class TwinCognitionLog(models.Model):
    STATUS_CHOICES = [
        ('info', 'Information'),
        ('retry', 'Self-Correction / Retry'),
        ('warning', 'Warning'),
        ('success', 'Success'),
        ('escalate', 'Escalation'),
    ]

    zone = models.ForeignKey(CityZone, on_delete=models.PROTECT, related_name='cognition_logs')
    cycle_id = models.CharField(max_length=64, blank=True, default='', db_index=True)
    agent_name = models.CharField(max_length=80, help_text="Sensing, Prediction, Simulation, Explainability, Alert, or Orchestrator")
    action_taken = models.CharField(max_length=200)
    reasoning_text = models.TextField(help_text="Detailed agent rationale and cognitive reasoning trail")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='info')
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['zone', '-timestamp']),
        ]

    def __str__(self):
        return f"[{self.agent_name}] {self.action_taken} ({self.zone.name}) - {self.status}"


class FloodPrediction(models.Model):
    zone = models.ForeignKey(CityZone, on_delete=models.PROTECT, related_name='predictions')
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    flood_extent_geojson = models.JSONField(
        default=dict,
        help_text="FeatureCollection GeoJSON of flooded polygons"
    )
    predicted_depth_m = models.FloatField(default=0.0, help_text="Estimated peak flood depth in meters")
    confidence_score = models.FloatField(default=0.88, help_text="Model prediction confidence 0.0 - 1.0")
    explanation_image = models.ImageField(upload_to='explanations/', blank=True, null=True)
    explanation_summary = models.TextField(blank=True, default='')
    depth_heightmap_grid = models.JSONField(
        default=list,
        help_text="2D array (e.g. 64x64) of normalized water depths for Three.js GLSL vertex displacement"
    )
    feature_importance_scores = models.JSONField(
        default=dict,
        help_text="Per-building and per-grid SHAP/Grad-CAM importance scores for 3D Explanation View"
    )
    is_fused_prediction = models.BooleanField(default=False)
    primary_sar_source = models.CharField(
        max_length=50,
        choices=[('eos4', 'ISRO EOS-04 SAR'), ('sentinel1', 'Copernicus Sentinel-1 SAR')],
        default='eos4',
        help_text="Primary satellite SAR telemetry sensor"
    )
    isro_validation_score = models.FloatField(
        null=True,
        blank=True,
        help_text="IoU agreement metric against ISRO Bhoonidhi WaterSpread Ground Truth"
    )

    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['zone', '-timestamp']),
        ]

    def __str__(self):
        return f"Prediction for {self.zone.name} @ {self.timestamp.strftime('%H:%M:%S')} - Depth: {self.predicted_depth_m}m (Conf: {self.confidence_score:.2f})"


class InfrastructureRiskFlag(models.Model):
    zone = models.ForeignKey(CityZone, on_delete=models.PROTECT, related_name='risk_flags')
    risk_score = models.FloatField(default=0.75, help_text="Composite recurring risk score (0.0 - 1.0)")
    recurring_events_count = models.IntegerField(default=1, help_text="Number of high-risk prediction cycles in window")
    primary_bottleneck = models.CharField(max_length=200, help_text="Primary civil infrastructure deficiency")
    recommended_upgrade = models.TextField(help_text="Recommended engineering mitigation (e.g. storm drain widening)")
    flagged_at = models.DateTimeField(auto_now_add=True)
    resolved = models.BooleanField(default=False)

    class Meta:
        ordering = ['-risk_score', '-recurring_events_count']

    def __str__(self):
        return f"[Upgrade Flag] {self.zone.name} (Risk: {self.risk_score:.2f}) - {self.primary_bottleneck}"

