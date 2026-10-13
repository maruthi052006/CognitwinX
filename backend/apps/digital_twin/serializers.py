from rest_framework import serializers
from .models import CityZone, TwinState, TwinCognitionLog, FloodPrediction, InfrastructureRiskFlag

class CityZoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = CityZone
        fields = [
            'id', 'name', 'city', 'boundary', 'elevation_avg', 
            'criticality', 'building_footprints_geojson',
            'center_lat', 'center_lng', 'drainage_capacity_index', 'created_at'
        ]

class TwinStateSerializer(serializers.ModelSerializer):
    zone_name = serializers.ReadOnlyField(source='zone.name')

    class Meta:
        model = TwinState
        fields = [
            'id', 'zone', 'zone_name', 'timestamp', 'rainfall_mm',
            'sar_image_path', 'current_confidence', 'fused_mode',
            'water_level_sensor_m'
        ]

class TwinCognitionLogSerializer(serializers.ModelSerializer):
    zone_name = serializers.ReadOnlyField(source='zone.name')

    class Meta:
        model = TwinCognitionLog
        fields = [
            'id', 'zone', 'zone_name', 'cycle_id', 'agent_name',
            'action_taken', 'reasoning_text', 'status', 'timestamp'
        ]

class FloodPredictionSerializer(serializers.ModelSerializer):
    zone_name = serializers.ReadOnlyField(source='zone.name')
    zone_criticality = serializers.ReadOnlyField(source='zone.criticality')

    class Meta:
        model = FloodPrediction
        fields = [
            'id', 'zone', 'zone_name', 'zone_criticality', 'timestamp',
            'flood_extent_geojson', 'predicted_depth_m', 'confidence_score',
            'explanation_image', 'explanation_summary',
            'depth_heightmap_grid', 'feature_importance_scores',
            'is_fused_prediction', 'primary_sar_source', 'isro_validation_score'
        ]

class ExplanationDetailSerializer(serializers.ModelSerializer):
    zone_name = serializers.ReadOnlyField(source='zone.name')

    class Meta:
        model = FloodPrediction
        fields = [
            'id', 'zone', 'zone_name', 'timestamp', 'confidence_score',
            'predicted_depth_m', 'explanation_image', 'explanation_summary',
            'feature_importance_scores'
        ]

class InfrastructureRiskFlagSerializer(serializers.ModelSerializer):
    zone_name = serializers.ReadOnlyField(source='zone.name')
    zone_city = serializers.ReadOnlyField(source='zone.city')
    zone_criticality = serializers.ReadOnlyField(source='zone.criticality')

    class Meta:
        model = InfrastructureRiskFlag
        fields = [
            'id', 'zone', 'zone_name', 'zone_city', 'zone_criticality',
            'risk_score', 'recurring_events_count', 'primary_bottleneck',
            'recommended_upgrade', 'flagged_at', 'resolved'
        ]

