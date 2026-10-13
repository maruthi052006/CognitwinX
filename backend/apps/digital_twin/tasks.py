import logging
from celery import shared_task
from django.db.models import Avg, Max, Count, Q
from .models import CityZone, FloodPrediction, InfrastructureRiskFlag

logger = logging.getLogger(__name__)

@shared_task(name='tasks.flag_recurring_risk_zones')
def flag_recurring_risk_zones() -> dict:
    """
    Analyzes FloodPrediction history to identify zones/drainage points that
    repeatedly appear as high-risk across multiple events, writing results to
    InfrastructureRiskFlag model, surfaced on the dashboard as
    'Recommended Upgrade Priorities'.
    """
    zones = CityZone.objects.all()
    flagged_count = 0
    results = []

    # Diagnostic bottleneck mapping based on zone attributes
    BOTTLENECK_CATALOG = {
        'hospital': ("Emergency vehicular access submergence / low-lying culvert backflow",
                     "Construct perimeter retention swales & install redundant high-volume axial dewatering pumps."),
        'critical_infra': ("Substation & transit corridor flooding / undersized arterial outfall",
                          "Widen primary arterial stormwater discharge canal and install SCADA-actuated tide gates."),
        'school': ("Student evacuation route inundation / localized depression ponding",
                   "Regrade school perimeter road and construct underground modular rainwater percolation tanks."),
        'normal': ("Low elevation natural basin accumulation / drain siltation",
                   "Desilt secondary micro-canals and upgrade culvert capacity to 50-year return period standard.")
    }

    for zone in zones:
        preds = zone.predictions.all()
        if not preds.exists():
            continue

        # Count occurrences where predicted depth >= 0.35m
        high_risk_preds = preds.filter(predicted_depth_m__gte=0.35)
        count = high_risk_preds.count()

        # If zone repeatedly exceeds risk threshold or has high criticality with moderate depth
        avg_depth = preds.aggregate(Avg('predicted_depth_m'))['predicted_depth_m__avg'] or 0.0
        max_depth = preds.aggregate(Max('predicted_depth_m'))['predicted_depth_m__max'] or 0.0

        if count >= 1 or avg_depth >= 0.25 or zone.criticality in ('hospital', 'critical_infra'):
            # Calculate composite recurring risk score (0.0 to 1.0)
            criticality_multiplier = 1.3 if zone.criticality in ('hospital', 'critical_infra') else 1.0
            drainage_penalty = (1.0 - zone.drainage_capacity_index) * 0.4
            depth_component = min(0.5, (max_depth / 1.5) * 0.5)
            risk_score = round(min(0.99, max(0.40, (depth_component + drainage_penalty) * criticality_multiplier)), 2)

            bottleneck, upgrade = BOTTLENECK_CATALOG.get(zone.criticality, BOTTLENECK_CATALOG['normal'])

            flag_obj, created = InfrastructureRiskFlag.objects.update_or_create(
                zone=zone,
                defaults={
                    'risk_score': risk_score,
                    'recurring_events_count': max(1, count),
                    'primary_bottleneck': bottleneck,
                    'recommended_upgrade': upgrade,
                    'resolved': False
                }
            )
            flagged_count += 1
            results.append({
                'zone_name': zone.name,
                'risk_score': risk_score,
                'recurring_events_count': flag_obj.recurring_events_count,
                'primary_bottleneck': bottleneck
            })

    logger.info(f"[Infrastructure Risk Flagging] Flagged {flagged_count} recurring risk priority zones.")
    return {
        'status': 'completed',
        'flagged_count': flagged_count,
        'results': results
    }
