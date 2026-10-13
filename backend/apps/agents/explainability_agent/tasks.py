import logging
from celery import shared_task
from apps.digital_twin.models import FloodPrediction
from .shap_engine import generate_explanation_artifacts

logger = logging.getLogger(__name__)

@shared_task(name='tasks.run_explainability_agent')
def run_explainability_agent(prediction_id: int, input_patch: list = None) -> dict:
    """
    AGENT 4 — EXPLAINABILITY AGENT (Self-Reflection)
    - Generates Grad-CAM / SHAP feature attribution
    - Saves explanation heatmap image
    - Attaches plain-language reasoning text and per-building scores
    """
    prediction = FloodPrediction.objects.get(id=prediction_id)
    zone = prediction.zone

    artifacts = generate_explanation_artifacts(
        zone=zone,
        prediction=prediction,
        input_patch=input_patch or [[0.5]*128]*128
    )

    # Attach explanation to prediction in database
    prediction.explanation_summary = artifacts['explanation_summary']
    prediction.feature_importance_scores = artifacts['feature_importance_scores']
    prediction.save()

    logger.info(f"[Explainability Agent] Generated explanation for Prediction #{prediction.id} ({zone.name})")

    return {
        'prediction_id': prediction.id,
        'explanation_summary': artifacts['explanation_summary'],
        'explanation_image_url': artifacts['explanation_image_url'],
        'feature_importance_scores': artifacts['feature_importance_scores']
    }
