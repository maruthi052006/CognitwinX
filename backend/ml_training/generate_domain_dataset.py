"""
Synthetic Domain Dataset Generator for CognitwinX Domain-Specific LLM.
Generates 1,000+ instruction pairs across:
- NDMA Guidelines & Urban Flood SOPs
- IMD Terminology & Rainfall Thresholds
- Twin Architecture, Sensors (SAR VH/VV, ISRO EOS-04, Sentinel-1/2, IMERG), and 7 Agents
- Agent Response Voices (Prediction, Explainability, Alert, Simulation)
- Strict Domain Refusal Examples for out-of-scope queries
Output format: JSONL ready for SFTTrainer (Llama-3.2-3B-Instruct / Qwen2.5-1.5B-Instruct).
"""
import os
import json
import random
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).resolve().parent
DATASET_DIR = BASE_DIR / "domain_dataset"

CITIES_AND_ZONES = [
    ("Chennai", "Velachery", "Residential Lowland / Lake Catchment", 0.78, "critical"),
    ("Chennai", "T. Nagar", "Commercial Hub / Usman Road Corridor", 0.62, "high"),
    ("Bengaluru", "Koramangala 4th Block", "Stormwater Bottleneck / Valley Zone", 0.58, "high"),
    ("Bengaluru", "Outer Ring Road (Bellandur)", "Tech Corridor / Wetland Encroachment", 0.85, "critical"),
    ("Mumbai", "Hindmata, Dadar", "Central Depression / High-Tide Bottleneck", 0.72, "high"),
    ("Mumbai", "Kurla West (Mithi River)", "Riverine Confluence / Slum Catchment", 0.94, "critical"),
    ("Hyderabad", "Nadeem Colony (Tolichowki)", "Lake Bed Encroachment", 0.65, "high"),
    ("Hyderabad", "Begumpet (Piket Nala)", "Arterial Underpass Depression", 0.48, "medium"),
]

QUESTION_TEMPLATES = [
    "What is the current flood risk and depth forecast for {zone} in {city}?",
    "Give me the latest Attention U-Net prediction for {zone}.",
    "Is {zone} currently safe from waterlogging under current IMERG rainfall?",
    "Report the flood intelligence metrics for {zone}, {city}.",
    "What does the Cognitive Digital Twin predict for {zone} right now?",
]

EXPLAIN_TEMPLATES = [
    "Why is {zone} facing {severity} flood risk?",
    "Explain the causal factors driving water accumulation in {zone}.",
    "What are the SHAP and Grad-CAM feature importances for the flood forecast in {zone}?",
    "Provide the scientific reasoning behind the water depth forecast in {zone}.",
]

WHATIF_TEMPLATES = [
    "Simulate a scenario where rainfall increases by {delta}% in {zone}.",
    "What happens to {zone} if precipitation intensifies by {delta}% over the next 4 hours?",
    "Run a hydrodynamic what-if simulation for {zone} with {delta}% higher rainfall and 30% drainage blockage.",
]

OFF_TOPIC_QUERIES = [
    "Write a song about love and summer.",
    "What are the best stocks to buy in 2026?",
    "How do I fix a leaking faucet in my kitchen?",
    "Explain quantum entanglement in simple terms.",
    "Give me a recipe for traditional Hyderabadi Biryani.",
    "Who directed the movie Inception and what was the ending?",
    "Help me write a cover letter for a software engineering job.",
    "What is the capital of Argentina and what language is spoken there?",
    "Write a JavaScript function to reverse a linked list.",
    "Can you generate a horoscope for Gemini today?",
]

REFUSAL_RESPONSES = [
    "I am CognitwinX, a domain-specialized Cognitive Digital Twin for urban flood prediction and disaster management. I cannot assist with topics outside hydrology, satellite radar telemetry, and flood emergency response.",
    "This query is beyond the operational scope of the CognitwinX flood intelligence system. I am restricted to flood forecasting, sensor telemetry, and NDMA emergency protocols.",
    "I do not answer general knowledge or out-of-domain inquiries. Please ask me about flood depth predictions, SAR backscatter analysis, what-if inundation scenarios, or evacuation SOPs.",
]


def load_seed_files():
    seeds = []
    seed_files = [
        "ndma_guidelines.json",
        "imd_terminology.json",
        "twin_concepts.json",
        "scenario_examples.json",
        "refusal_examples.json"
    ]
    for fn in seed_files:
        path = DATASET_DIR / fn
        if path.exists():
            with open(path, "r", encoding="utf-8") as f:
                seeds.extend(json.load(f))
    return seeds


def generate_synthetic_samples(target_count=1200):
    samples = []
    seeds = load_seed_files()
    samples.extend(seeds)

    # 1. Expand Zone Prediction Variations
    rainfall_rates = [25, 45, 60, 75, 90, 110, 140]
    time_windows = ["current", "past 3 hours", "monsoon peak", "overnight", "high tide"]
    for city, zone, desc, depth, severity in CITIES_AND_ZONES:
        for q_tpl in QUESTION_TEMPLATES:
            for rain in [35, 55, 75, 95]:
                q = q_tpl.format(zone=zone, city=city)
                conf = round(random.uniform(0.85, 0.94), 3)
                iou = round(random.uniform(0.87, 0.92), 3)
                adjusted_depth = round(depth * (rain / 60.0), 2)
                cur_severity = "critical" if adjusted_depth > 0.75 else ("high" if adjusted_depth > 0.45 else "medium")
                ans = (
                    f"🌊 [Prediction Agent Intelligence for {zone}, {city}]\n"
                    f"• Geographic Classification: {desc}\n"
                    f"• Predicted Water Depth: {adjusted_depth}m ({cur_severity.upper()} flood risk)\n"
                    f"• Attention U-Net Model Confidence: {conf*100:.1f}%\n"
                    f"• Primary Radar Sensor: ISRO EOS-04 SAR (MRS L2B, σ° VH: {-18.0 - random.random()*4:.1f} dB)\n"
                    f"• ISRO Bhoonidhi WaterSpread Agreement: {iou} IoU\n"
                    f"• Precipitation Telemetry: NASA IMERG Early Run ({rain} mm/hr)\n"
                    f"• Recommended Action: {'Immediate evacuation staging & SDMA dispatch' if cur_severity == 'critical' else 'Deploy mobile dewatering pumps & monitor arterial culverts'}."
                )
                samples.append({"instruction": q, "input": f"City: {city}, Ward: {zone}, Rain: {rain}mm/hr", "output": ans})

    # 2. Expand Explainability Variations
    for city, zone, desc, depth, severity in CITIES_AND_ZONES:
        for ex_tpl in EXPLAIN_TEMPLATES:
            for sensor_mode in ["SAR Base", "Fused SAR+Optical (NDWI)"]:
                q = ex_tpl.format(zone=zone, severity=severity)
                attr_dem = random.randint(35, 48)
                attr_imperv = random.randint(25, 35)
                attr_drain = 100 - attr_dem - attr_imperv
                ans = (
                    f"🧠 [Explainability Agent - Attribution Rationale for {zone}]\n"
                    f"Mode: {sensor_mode} Analysis via SHAP DeepExplainer and Grad-CAM:\n"
                    f"1. Topographic Low Elevation (DEM Gradient): +{attr_dem}% causal weight — runoff naturally pools in this basin.\n"
                    f"2. Built-up Impervious Surface Area: +{attr_imperv}% causal weight — high paving density prevents percolation.\n"
                    f"3. Stormwater Drainage Inadequacy: +{attr_drain}% causal weight — outfall capacity is overwhelmed by upstream discharge.\n"
                    f"Result: The combination of local topography and compromised drainage velocity accounts for {attr_dem+attr_imperv}% of total flood risk."
                )
                samples.append({"instruction": q, "input": f"Zone: {zone}, Mode: {sensor_mode}", "output": ans})

    # 3. Expand What-If Simulation Variations
    for city, zone, desc, depth, severity in CITIES_AND_ZONES:
        for delta in [10, 20, 30, 40, 50, 60]:
            for drain_fac in [0.5, 0.7, 1.0]:
                for wi_tpl in WHATIF_TEMPLATES:
                    q = wi_tpl.format(zone=zone, delta=delta)
                    peak_depth = round(depth * (1.0 + delta / 100.0 * (1.2 - drain_fac * 0.4)), 2)
                    ans = (
                        f"🌊 [Simulation Agent - Hydrodynamic What-If Simulation]\n"
                        f"Scenario: {delta:+d}% Precipitation Surge | Drainage Efficiency: {int(drain_fac*100)}% in {zone}, {city}\n"
                        f"• Current Baseline: {depth}m → Projected Peak: {peak_depth}m\n"
                        f"• 2D Kinematic Wave Propagation:\n"
                        f"  - T+1 Hour: {round(depth + (peak_depth-depth)*0.35, 2)}m\n"
                        f"  - T+2 Hours: {round(depth + (peak_depth-depth)*0.70, 2)}m\n"
                        f"  - T+3 Hours (Peak Crest): {peak_depth}m\n"
                        f"  - T+4 Hours: {round(peak_depth * 0.94, 2)}m (Slow gravitational recession)\n"
                        f"• Infrastructure Impact: {'Severe arterial road submergence; hospital power units require sandbagging' if peak_depth > 0.65 else 'Localized curb overflow; slow traffic transit'}."
                    )
                    samples.append({"instruction": q, "input": f"Drainage Efficiency: {int(drain_fac*100)}%", "output": ans})

    # 4. Expand Domain Refusals
    for q in OFF_TOPIC_QUERIES:
        for _ in range(25):
            resp = random.choice(REFUSAL_RESPONSES)
            samples.append({"instruction": q, "input": "", "output": resp})

    # 5. Expand NDMA Guidelines and Sensor Physics Q&A
    for seed in seeds:
        for prefix in ["Explain: ", "From NDMA guidelines: ", "Under standard flood SOP: ", "Technical query: "]:
            samples.append({
                "instruction": prefix + seed["instruction"],
                "input": seed.get("input", ""),
                "output": seed["output"]
            })

    random.shuffle(samples)
    return samples[:target_count]


def main():
    DATASET_DIR.mkdir(parents=True, exist_ok=True)
    samples = generate_synthetic_samples(target_count=1250)
    print(f"Generated {len(samples)} synthetic domain instruction pairs.")

    # Convert to ChatML / Llama-3 instruction format
    formatted = []
    for s in samples:
        sys_msg = "You are CognitwinX, an AI Cognitive Digital Twin for Indian urban flood prediction and disaster management. Provide factually grounded, precise operational insights. Decline all off-topic queries."
        user_content = s['instruction'] + (f"\nContext: {s['input']}" if s['input'] else "")
        formatted.append({
            "messages": [
                {"role": "system", "content": sys_msg},
                {"role": "user", "content": user_content},
                {"role": "assistant", "content": s['output']}
            ],
            "instruction": s['instruction'],
            "input": s['input'],
            "output": s['output']
        })

    # Train / Val split (90 / 10)
    split_idx = int(len(formatted) * 0.9)
    train_data = formatted[:split_idx]
    val_data = formatted[split_idx:]

    train_path = DATASET_DIR / "train.jsonl"
    val_path = DATASET_DIR / "val.jsonl"

    with open(train_path, "w", encoding="utf-8") as f:
        for item in train_data:
            f.write(json.dumps(item, ensure_ascii=False) + "\n")

    with open(val_path, "w", encoding="utf-8") as f:
        for item in val_data:
            f.write(json.dumps(item, ensure_ascii=False) + "\n")

    print(f"Saved {len(train_data)} training samples to {train_path}")
    print(f"Saved {len(val_data)} validation samples to {val_path}")


if __name__ == "__main__":
    main()
