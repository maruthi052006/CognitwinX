"""Generates realistic Twin Cognition Feed log entries matching each agent's
actual 'voice', so the live feed looks authentic even with mock data."""
import random

MOCK_REASONING_TEMPLATES = {
    "Sensing": [
        "Fetched new SAR tile for {zone} — rainfall reading {rain}mm in last 30 min.",
        "Rainfall sensor update: {rain}mm detected, refreshing twin state for {zone}.",
        "ISRO EOS-04 C-band radar swath acquired for {zone} at 18m resolution.",
        "Copernicus Sentinel-1 SAR VH backscatter ingested for {zone}.",
    ],
    "Prediction": [
        "Flood depth estimated at {depth}m with {conf}% confidence for {zone}.",
        "Prediction complete — {zone} shows {depth}m depth, confidence {conf}%.",
        "Attention U-Net spatial feature extraction finished for {zone} in 1.18s.",
        "Hydrodynamic runoff peak depth estimated at {depth}m for {zone}.",
    ],
    "Orchestrator": [
        "Confidence {conf}% evaluated against safety threshold for {zone}.",
        "Confidence {conf}% below threshold — requesting fused data for {zone}.",
        "Re-evaluation complete for {zone}, confidence now {conf}%.",
        "Autonomous cognitive workflow cycle executed successfully for {zone}.",
    ],
    "Simulation": [
        "Projected flood spread for {zone} over next 2 hours: rising trend detected.",
        "What-if scenario computed for {zone} — depth could reach {depth}m.",
        "2D shallow-water kinematic wave forward simulation updated for {zone}.",
        "Runoff progression analysis shows 18% flow reduction along central canal.",
    ],
    "Explainability": [
        "High confidence driven by rainfall spike + low elevation near {zone} drain junction.",
        "Grad-CAM attribution highlights topographic depression corridor in {zone}.",
        "Feature attribution indicates 64% contribution from accumulated precipitation.",
    ],
    "Alert": [
        "Threshold exceeded for {zone} — alert dispatched to SDMA.",
        "{zone} within safe limits, continuing monitoring.",
        "CAP protocol alert payload queued for NDMA emergency broadcast in {zone}.",
        "SMS dispatch verification confirmed for emergency coordinators in {zone}.",
    ],
}

def generate_mock_cognition_entry(zone_name, agent_name, depth=None, confidence=None, rainfall=None):
    # Normalize agent name to match template keys
    normalized_agent = agent_name
    for key in MOCK_REASONING_TEMPLATES.keys():
        if key.lower() in agent_name.lower():
            normalized_agent = key
            break

    templates = MOCK_REASONING_TEMPLATES.get(normalized_agent, MOCK_REASONING_TEMPLATES["Sensing"])
    template = random.choice(templates)
    
    d = depth if depth is not None else round(random.uniform(0.1, 0.8), 2)
    c = int((confidence if confidence is not None else random.uniform(0.70, 0.95)) * 100)
    r = rainfall if rainfall is not None else round(random.uniform(15, 80), 1)

    return template.format(
        zone=zone_name,
        depth=d,
        conf=c,
        rain=r,
    )
