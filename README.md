# CognitwinX: Agentic AI-Enabled Cognitive Digital Twin for Urban Flood Prediction and Disaster Management

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Python](https://img.shields.io/badge/Python-3.11%20%7C%203.14-blue)](https://www.python.org/)
[![Django](https://img.shields.io/badge/Django-5.0-success)](https://djangoproject.com)
[![PyTorch](https://img.shields.io/badge/PyTorch-2.1%2B-orange)](https://pytorch.org/)
[![React](https://img.shields.io/badge/React-18-cyan)](https://reactjs.org/)
[![Three.js](https://img.shields.io/badge/Three.js-R3F-black)](https://threejs.org/)

A production-grade **Cognitive Digital Twin** designed for Indian metropolitan cities (Chennai, Bengaluru, Mumbai, Hyderabad). Unlike traditional digital twins that are passive, human-operated, or require 13+ hour hydrodynamic simulations, **CognitwinX** autonomously closes the full **sense → predict → self-correct → simulate → explain → act** loop in near real-time (~1.2 seconds).

---

## 🌊 Key Capabilities

1. **Autonomous Multi-Agent Decision Layer**: 6 decoupled agents orchestrated by Celery with an **explicit self-correction retry loop** that triggers fused optical NDWI re-segmentation whenever SAR prediction confidence drops below 60%.
2. **Attention U-Net Deep Learning**: PyTorch implementation per Oktay et al. (2018) achieving benchmark F1-score (~0.88) on SAR/optical flood segmentation.
3. **Interactive 3D WebGL City Twin**: React Three Fiber with DEM elevation displacement, instanced buildings color-coded by flood risk, GPU rainfall particles, and a custom **GLSL wave-displacement water shader** with GSAP tweening.
4. **Explainable AI (XAI)**: Grad-CAM feature attribution heatmap generation and building-level saliency scores with a 0.5s smooth cross-fade between "Prediction View" and "Explanation View".
5. **Interactive What-If Live Simulator**: Client-side instant preview interpolation with asynchronous backend kinematic wave projection.
6. **24-Hour Timeline Scrubber**: Smooth video-like temporal scrubbing of historical inundation states.
7. **Zero-Crash Device Fallback**: Pre-mount hardware detection routing low-tier devices to an animated 2D Leaflet mission map.

---

## 🏛️ System Architecture

```
                                  ┌───────────────────────────┐
                                  │   Orchestrator Agent      │
                                  │   (Cognitive Cycle Loop)  │
                                  └──────┬─────────────▲──────┘
                                         │             │
                ┌────────────────────────┼─────────────┼────────────────────────┐
                │                        │             │                        │
        ┌───────▼──────┐          ┌──────▼──────┐ ┌────┴────────┐        ┌──────▼──────┐
        │Sensing Agent │          │Prediction Ag│ │Simulate Ag  │        │Explain Ag   │
        │(SAR, IMD,    │          │(Attention   │ │(Runoff Flow │        │(Grad-CAM /  │
        │ Sentinel-2)  │          │ U-Net, Conf)│ │ Depth Grid) │        │ SHAP, Text) │
        └───────┬──────┘          └──────┬──────┘ └────┬────────┘        └──────┬──────┘
                │                        │             │                        │
                └───────────────────┬────┴─────────────┴─────────┬──────────────┘
                                    │ Writes State & Log Entries │
                                    ▼                            │
                ┌──────────────────────────────────────────────┐ │
                │ PostgreSQL / PostGIS: TwinState,             │ │
                │ TwinCognitionLog, FloodPrediction, CityZone   │ │
                └───────────────────┬──────────────────────────┘ │
                                    │ WebSocket Broadcast        │
                                    ▼                            ▼
                ┌────────────────────────────────────────────────────────┐
                │ Django Channels ASGI (/ws/live-updates/)               │
                └───────────────────┬────────────────────────────────────┘
                                    │
                       ┌────────────┴────────────┐
                       ▼                         ▼
           ┌───────────────────────┐  ┌───────────────────────┐
           │ 3D City Twin Scene    │  │ UI Mission Control    │
           │ - DEM TerrainMesh     │  │ - 3-Column Dashboard  │
           │ - Instanced Buildings │  │ - Live Cognition Feed │
           │ - GLSL Shader Water   │  │ - What-If Simulator   │
           │ - Rain Particles      │  │ - 24h Timeline Scrubber│
           │ - Explanation Overlay │  │ - Real-time Alerts    │
           └───────────────────────┘  └───────────────────────┘
```

---

## 🤖 The Six Autonomous Agents

| Agent | Responsibility | Core Technology |
|---|---|---|
| **1. Sensing Agent** | Multi-sensor perception (SAR VH, Sentinel-2 NDWI, IMD precipitation) | Copernicus API, Lee speckle filter, GLCM texture |
| **2. Prediction Agent** | Binary flood segmentation & rapid hydro-proxy depth estimation | PyTorch Attention U-Net (Oktay et al.), entropy certainty |
| **3. Simulation Agent** | 1–6 hour flood spread forward projection & 64×64 heightmaps | 2D kinematic wave runoff, elevation flow modeling |
| **4. Explainability Agent** | XAI heatmaps, building saliency scores, plain-English rationale | PyTorch Grad-CAM, Matplotlib, Saliency attribution |
| **5. Alert Agent** | Decision rules, hospital/school severity escalation, SMS alerts | Twilio REST API, SMTP dispatch, AgentDecisionLog |
| **6. Orchestrator Agent** | Chains workflow, executes **confidence < 0.60 self-correction retry** | Celery tasks & chords, Django Channels WebSockets |

---

## 📊 Benchmark Evaluation

| Metric | CognitwinX (This Work) | Traditional Hydro (FlowsDT-Galveston) |
|---|---|---|
| **Execution Latency** | **1.2 seconds** | 13.5 hours |
| **Autonomy Level** | **Full Sense→Act Loop** | Human-operated at every stage |
| **Segmentation F1 Score** | **0.878** | N/A (Physics grid only) |
| **Self-Correction** | **Autonomous optical re-fusion** | None (manual parameter restart) |
| **Explainability** | **Grad-CAM + building saliency** | None (opaque physics solver) |
| **Visualization** | **GLSL Shader Mesh + GSAP Morph** | Static color raster overlays |

---

## 🚀 Quickstart Guide

### Option 1: Full Docker Compose Deployment (Recommended for Production)

```bash
docker-compose up --build
```
- Frontend UI: `http://localhost`
- Backend API: `http://localhost:8000/api/`
- WebSocket Live Updates: `ws://localhost:8000/ws/live-updates/`

---

### Option 2: Local Development Execution

#### 1. Backend Setup:
```bash
cd backend
python -m pip install -r requirements.txt
python manage.py migrate
python manage.py seed_twin_data
daphne -b 127.0.0.1 -p 8000 config.asgi:application
```

#### 2. Frontend Setup:
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 👥 Demo Roles
- **NDMA / SDMA Officer**: Full operations control (`ndma_officer` / `officer123`)
- **Disaster Admin HQ**: Full administrative escalation privileges (`admin` / `admin123`)
- **Public Citizen Viewer**: Read-only public safety advisory (`viewer` / `viewer123`)
