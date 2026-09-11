# 💎 JewelCraft AI — Autonomous Haute Joaillerie 3D CAD Goldsmith

[![Gemini 3.6 Flash](https://img.shields.io/badge/Vision%20AI-Gemini%203.6%20Flash-4285F4?logo=google&logoColor=white)](https://aistudio.google.com/)
[![TripoSR 3D](https://img.shields.io/badge/3D%20Reconstruction-TripoSR%20Neural%20Field-FF6F00?logo=huggingface&logoColor=white)](https://huggingface.co/spaces/stabilityai/TripoSR)
[![GoldAPI Live](https://img.shields.io/badge/Valuation-GoldAPI.io%20Live%20Rates-FFD700?logo=coinbase&logoColor=black)](https://www.goldapi.io/)
[![Three.js](https://img.shields.io/badge/3D%20Engine-Three.js%20%2F%20R3F-000000?logo=threedotjs&logoColor=white)](https://threejs.org/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI%20Python-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React 18](https://img.shields.io/badge/Frontend-React%2018%20%2B%20TypeScript%20%2B%20Vite-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **From Jewelry Photo or Natural Language Prompt to Production-Ready, Watertight 3D CAD in Under 30 Seconds.**  
> Built for master goldsmiths, bespoke jewelry ateliers, and luxury maisons worldwide.

---

## 🏆 Hackathon & Team Information

* **Hackathon**: Syrus Hackathon 2026 by CodeCell Tinkerers from Computer Department VESIT
* **Team Name**: **RoboMasters**
* **Project Repository**: [https://github.com/Ash-Technologia/Jewelcraft-AI](https://github.com/Ash-Technologia/Jewelcraft-AI)
* **Lead Developer / Author**: Ash-Technologia ([aayushsinghavi@gmail.com](mailto:aayushsinghavi@gmail.com))

---

## 📌 Problem Statement

Traditional bespoke jewelry design is plagued by severe bottlenecks that inhibit artisans and drive up customer acquisition costs:

1. **Slow Turnaround Loops (3 to 7 Days)**:
   - Converting a customer's reference sketch or phone photo into a manufacturable 3D CAD model requires hours of manual spline extrusion in complex legacy software (Rhino, MatrixGold, Blender).
   - Back-and-forth consultation loops take days, causing high client drop-off in retail showrooms.

2. **Casting & 3D Print Failures (Non-Manifold Meshes)**:
   - Generic 3D generation tools produce non-watertight surfaces with inverted normals, self-intersecting polygons, or severed bypass ribbons that fail SLA/DLP 3D wax-printing.

3. **Color & Stone Washout in Digital Previews**:
   - Standard 3D previews blast high metalness over vertex colors, washing out authentic 18K yellow/rose gold warmth and reducing diamond pavé ribbons into gray blobs.

4. **Opacity in Material Costing**:
   - Goldsmiths traditionally calculate gold casting weights and gemstone valuations manually, introducing quote delays and price variance against live spot markets.

---

## 💡 The Solution: JewelCraft AI

**JewelCraft AI** is an autonomous high-jewelry studio that converts any camera photo, sketch, or text prompt into a **1:1 production-calibrated 3D CAD asset in seconds**, completely eliminating the traditional CAD bottleneck.

```
┌─────────────────┐       ┌───────────────────────┐       ┌────────────────────────┐       ┌────────────────────────┐
│  Jewelry Photo  │ ────► │  Gemini 3.6 Flash     │ ────► │  TripoSR Neural Field  │ ────► │  Watertight 3D CAD     │
│  or Text Prompt │       │  Multimodal Vision AI │       │  (300 Marching Cubes)  │       │  STL / OBJ / GLB       │
└─────────────────┘       └───────────────────────┘       └────────────────────────┘       └────────────────────────┘
                                      │                                                                │
                                      ▼                                                                ▼
                          ┌───────────────────────┐                                        ┌────────────────────────┐
                          │  GoldAPI.io Live      │ ─────────────────────────────────────► │  Live Spot Valuation   │
                          │  Spot Market Prices   │                                        │  & Casting Weight      │
                          └───────────────────────┘                                        └────────────────────────┘
```

### Key Breakthroughs:
* **Zero Pre-saved Models / 100% Dynamic**: Every single uploaded photo generates a fresh, unique 3D mesh via live multimodal neural synthesis.
* **Continuous Watertight Geometry**: Calibrated foreground boundaries (`foreground_ratio: 0.80`) and high-density 300 Marching Cubes resolution ensure complex ribbons, bypass loops, and bails never sever or clip.
* **Authentic Photo Color Fidelity**: Physical PBR shaders preserve diffuse vertex colors (`COLOR_0`), retaining rich gold warmth and micro-pavé diamond brilliance with clearcoat refractive index ($IOR = 2.417$).
* **Direct Production Export**: 1-click downloads for calibrated binary STL (for direct wax 3D printing), OBJ (polygonal mesh), and GLB (digital twin/AR).

---

## ✨ Features & Capabilities

| Capability | Description |
| :--- | :--- |
| **📸 Photo-to-3D Synthesis** | Drop any ring, necklace, pendant, earring, or cuff photo to generate a 1:1 solid mesh in ~18–25 seconds. |
| **✍️ Prompt-to-CAD Engine** | Describe any bespoke piece (e.g. *"18K rose gold bypass ring with pear-cut emerald and diamond pavé"*) to generate exact parametric CAD geometry. |
| **💎 Intelligent Multimodal Vision** | Powered by Gemini 3.6 Flash to identify category, stone count, facet cut, prong mount, and alloy with 98% confidence. |
| **🎨 Dual Visualizer Shading** | Toggle between **Photo Colors** (retaining authentic camera colors) and **Atelier Recolor** (18K Yellow Gold, Rose Gold, Platinum 950, White Gold). |
| **💡 Three Studio Lighting Presets** | Instant illumination switching: **Showroom** (sparkle spotlights), **Studio** (5500K daylight softbox), and **Dramatic** (exhibition chiaroscuro). |
| **⚖️ Live GoldAPI Spot Valuation** | Server-side cached live rates for Gold (XAU), Platinum (XPT), and Silver (XAG) in INR/USD with computed casting weights. |
| **🖨️ Wax-Print Ready Exports** | Watertight binary STL, OBJ, and GLB exports with zero non-manifold edges for seamless DLP/SLA castable resin printing. |

---

## 🛠️ Architecture & Tech Stack

### Frontend
* **Framework**: React 18 with TypeScript and Vite
* **3D Canvas**: Three.js & `@react-three/fiber` / `@react-three/drei`
* **Styling**: Luxury dark theme with Place Vendôme aesthetic (Vanilla CSS tokens, glassmorphism, gold accents)
* **Animation & Icons**: Framer Motion & Lucide React
* **State Management**: Zustand lightweight reactive stores

### Backend
* **API Engine**: FastAPI (Python 3.10+) with asynchronous I/O and CORS middleware
* **Multimodal Vision AI**: Google Gemini 3.6 Flash (`google.generativeai` / `google.genai`)
* **Fallback LLM**: OpenAI GPT-4o Vision API
* **Neural 3D Mesh Generator**: Hugging Face Spaces Gradio Client (`stabilityai/TripoSR` & `hysts/Shap-E`)
* **Live Market Pricing**: GoldAPI.io REST API (with 1-hour in-memory TTL caching)
* **Security & Defense**: IP-based sliding window rate-limiting middleware (10 requests/min)

---

## 🚀 Quickstart & Local Setup

### Prerequisites
* **Node.js**: v18.0 or higher ([Download](https://nodejs.org/))
* **Python**: v3.10, v3.11, or v3.12 ([Download](https://www.python.org/))
* **API Keys (Free Tiers Available)**:
  * [Google AI Studio](https://aistudio.google.com/) for `GEMINI_API_KEY` (Free)
  * [Hugging Face](https://huggingface.co/settings/tokens) for `HF_TOKEN` (Free)
  * [GoldAPI.io](https://www.goldapi.io/) for `GOLDAPI_KEY` (Free tier: 100 req/mo)
  * *(Optional)* [OpenAI](https://platform.openai.com/) for `OPENAI_API_KEY`

---

### Option 1: 1-Click Launch (Windows)

Double-click `start.bat` in the project root:
```cmd
start.bat
```
This batch script checks environments, installs dependencies, verifies `.env` templates, and launches both backend and frontend servers simultaneously.

---

### Option 2: Manual Setup

#### 1. Clone the Repository
```bash
git clone https://github.com/Ash-Technologia/Jewelcraft-AI.git
cd Jewelcraft-AI
```

#### 2. Backend Setup
```bash
cd backend
python -m pip install -r requirements.txt

# Create your environment file
cp .env.example .env
```
Edit `backend/.env` with your API keys:
```env
GEMINI_API_KEY=your_gemini_api_key_here
HF_TOKEN=your_huggingface_token_here
GOLDAPI_KEY=your_goldapi_key_here
```
Run the FastAPI backend server:
```bash
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```
* Backend API health: `http://127.0.0.1:8000/health`
* Interactive API docs: `http://127.0.0.1:8000/docs`

#### 3. Frontend Setup
In a new terminal:
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173/` in your browser.

---

## 🌐 Production Backend Deployment

The FastAPI backend is containerized and production-ready for deployment on **Render**, **Railway**, **Google Cloud Run**, **Docker**, or **Linux VPS / AWS EC2**.

> 📖 **Full Step-by-Step Guide**: See the comprehensive [Backend Deployment Guide](backend/DEPLOYMENT.md) for detailed configuration, Nginx reverse proxy templates, and systemd service scripts.

### 1. Render.com (Fastest Cloud Setup)
1. Link your GitHub repo to a **Render Web Service**.
2. Set **Root Directory** to `backend`.
3. Set **Build Command** to `pip install -r requirements.txt`.
4. Set **Start Command** to `uvicorn main:app --host 0.0.0.0 --port $PORT`.
5. Add environment variables: `PYTHON_VERSION = 3.11.9` *(required to avoid Python 3.14 wheel compilation errors)*, `GEMINI_API_KEY`, `HF_TOKEN`, `GOLDAPI_KEY`, `ALLOWED_ORIGINS`.

### 2. Docker Container Deployment
```bash
cd backend
docker build -t jewelcraft-backend .
docker run -d -p 8000:8000 --env-file .env --restart unless-stopped jewelcraft-backend
```

### 3. Railway / Google Cloud Run / AWS EC2
Check out [backend/DEPLOYMENT.md](backend/DEPLOYMENT.md) for 1-click manifests and serverless configurations.

---

## 🌟 Benefits & Industry Impact

### 1. For Jewelers & Goldsmiths
* **95% Time Savings**: Slash 3D CAD modeling turnaround from **3 days to under 30 seconds**.
* **Zero Barrier to Entry**: No need for expensive specialized CAD hardware or decades of CAD engineering experience.

### 2. For Retail Clients
* **Instant Showroom Experience**: Turn customer reference photos or napkin sketches into an interactive 3D model during their initial consultation.
* **Transparent Pricing**: Real-time valuation grounded in live precious metal spot rates prevents sticker shock.

### 3. For Manufacturers & Foundries
* **Casting Reliability**: Watertight, non-manifold geometry drastically reduces wax printing failures, mold breakages, and precious metal casting porosity.

---

## 🌍 Economic & Environmental Impact

* **Scrap & Waste Reduction**: Precise volume calculation enables exact metal alloy allocation, eliminating over-casting and hazardous chemical stripping waste.
* **Democratizing Artisan Craftsmanship**: Small independent jewelers and local goldsmiths gain the technological capabilities previously reserved for multi-million-dollar luxury conglomerates.

---

## 🔮 Future Roadmap & Horizons

- [ ] **Augmented Reality (AR) Virtual Try-On**: Real-time WebXR tracking to project rings onto client hands and pendants onto necklines directly in mobile browsers.
- [ ] **Automated 5-Axis CNC Toolpathing**: Direct translation of generated meshes into G-code for automated micro-milling machines.
- [ ] **AI Gemstone Prong Optimization**: Auto-calculating prong claw tension and micro-bezel seating based on stone hardness (Mohs scale).
- [ ] **Blockchain Provenance Certification**: Minting ERC-721 digital twin certificates verifying metal purity, gemstone caratage, and manufacturing specs.

---

## 📄 License & Attribution

This project is licensed under the **MIT License**.  
Developed with ❤️ by **RoboMasters** for **Syrus Hackathon 2026** (CodeCell Tinkerers, Computer Department VESIT).
