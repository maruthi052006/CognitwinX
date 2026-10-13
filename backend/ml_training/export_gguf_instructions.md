# CognitwinX: Local CPU LLM Inference Guide (llama.cpp & Ollama)

This document provides instructions for serving the fine-tuned domain LLM on the development team's **CPU-only laptops (8GB RAM, AMD Ryzen 5 / Intel Core i5)** without any dedicated GPU requirement.

---

## 1. Overview & Architecture

Per **Specification Sections 3 & 8**:
1. **Training** is executed on Google Colab or Kaggle (free T4 GPU) using the provided notebooks:
   - `backend/ml_training/finetune_domain_llm_colab.ipynb`
   - `backend/ml_training/finetune_domain_llm.py`
2. **Export**: The fine-tuned weights are merged and converted to **GGUF Q4_K_M** (4-bit quantized format, ~1.2GB file size).
3. **Local Serving**: Served via `llama.cpp` server or `Ollama` on localhost port `8080` or `11434`.
4. **Backend Connection**: The CognitwinX Django backend talks to this server via standard OpenAI-compatible API endpoint `/v1/chat/completions`.

---

## Option A: Serving via Ollama (Recommended, Easiest)

### Step 1: Install Ollama
Download and install Ollama from [https://ollama.com/download](https://ollama.com/download) for Windows / Linux / macOS.

### Step 2: Create a `Modelfile`
Create a file named `Modelfile` in the folder where you placed `cognitwinx_flood_llm_q4.gguf`:
```dockerfile
FROM ./cognitwinx_flood_llm_q4.gguf

PARAMETER temperature 0.2
PARAMETER top_p 0.95
PARAMETER stop "<|im_end|>"

SYSTEM """You are CognitwinX, an AI Cognitive Digital Twin for Indian urban flood prediction and disaster management. Provide factually grounded operational guidance based on NDMA SOPs, SAR radar backscatter, and real-time telemetry. Politely decline all off-topic queries."""
```

### Step 3: Register the Model
Run in your terminal:
```bash
ollama create cognitwinx-domain-llm -f Modelfile
```

### Step 4: Run the Model
```bash
ollama run cognitwinx-domain-llm
```
Ollama automatically exposes an OpenAI-compatible REST API at:
`http://localhost:11434/v1`

### Step 5: Configure CognitwinX Backend `.env`
In `backend/.env`:
```env
LLM_BASE_URL=http://localhost:11434/v1
LLM_MODEL=cognitwinx-domain-llm
LLM_API_KEY=ollama
```

---

## Option B: Serving via `llama.cpp` (Ultra-low RAM, 8GB laptop friendly)

### Step 1: Download llama.cpp binary
Download the latest pre-compiled binary release for Windows (`llama-bXXXX-bin-win-cpu-x64.zip`) from:
[https://github.com/ggerganov/llama.cpp/releases](https://github.com/ggerganov/llama.cpp/releases)

### Step 2: Start the HTTP Server
Run the HTTP server with 4 CPU threads:
```bash
llama-server.exe -m ./cognitwinx_flood_llm_q4.gguf -c 2048 --threads 4 --port 8080
```

### Step 3: Configure CognitwinX Backend `.env`
In `backend/.env`:
```env
LLM_BASE_URL=http://localhost:8080/v1
LLM_MODEL=cognitwinx-domain-llm
LLM_API_KEY=not-needed
```

---

## Option C: Backup Live Presentation Tunneling (Per Section 3)

For the final live project viva/evaluation, in case local CPU inference speed is constrained by background apps:
1. Run the model on a live Google Colab T4 session.
2. Expose the Colab port `8000` via `ngrok` or `localtunnel`:
   ```python
   !pip install pyngrok
   from pyngrok import ngrok
   public_url = ngrok.connect(8000).public_url
   print("Live Cloud GPU Tunnel:", public_url)
   ```
3. Set `LLM_BASE_URL` in `backend/.env` to the tunnel URL.
4. If no LLM endpoint is active, the CognitwinX Chat Router Agent **automatically gracefully falls back** to the internal deterministic agent tool router and local RAG engine (`all-MiniLM-L6-v2`) with zero crashes or errors!
