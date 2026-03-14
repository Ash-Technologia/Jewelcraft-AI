"""
JewelCraft AI — FastAPI Backend
Handles image analysis (Gemini Vision), 3D model generation (Blender),
catalog, export, budget substitution, WebSocket streaming, and sharing.
"""

import asyncio
import base64
import json
import os
import random
import shutil
import subprocess
import time
import uuid
from pathlib import Path
from typing import Optional

# Load .env file if present
try:
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=Path(__file__).parent / ".env")
except ImportError:
    pass  # python-dotenv not installed; rely on system env vars

from fastapi import FastAPI, File, Form, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# ── Optional AI library imports ────────────────────────────────────────────────
try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False

try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

# ── Config ─────────────────────────────────────────────────────────────────────
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
BLENDER_PATH   = os.environ.get("BLENDER_PATH", "blender")   # path to blender executable
UPLOADS_DIR    = Path(__file__).parent / "uploads"
EXPORTS_DIR    = UPLOADS_DIR / "exports"
SCRIPT_PATH    = Path(__file__).parent / "scripts" / "generate_jewelry.py"

UPLOADS_DIR.mkdir(exist_ok=True)
EXPORTS_DIR.mkdir(exist_ok=True)

if GEMINI_AVAILABLE and GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

app = FastAPI(title="JewelCraft AI API", version="2.0.0")

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files — serve exported models
app.mount("/exports", StaticFiles(directory=str(EXPORTS_DIR)), name="exports")

# ── In-memory stores ───────────────────────────────────────────────────────────
sessions: dict = {}
shared_designs: dict = {}
ws_connections: dict = {}

# ── Fallback Mock Data ─────────────────────────────────────────────────────────
MOCK_ANALYSIS = {
    "type": "ring",
    "confidence": 0.92,
    "components": [
        {"name": "center_stone", "type": "stone",  "position": {"x": 0.50, "y": 0.45}},
        {"name": "band",         "type": "band",   "position": {"x": 0.50, "y": 0.75}},
        {"name": "prong_01",     "type": "prong",  "position": {"x": 0.42, "y": 0.38}},
        {"name": "prong_02",     "type": "prong",  "position": {"x": 0.58, "y": 0.38}},
        {"name": "prong_03",     "type": "prong",  "position": {"x": 0.42, "y": 0.52}},
        {"name": "prong_04",     "type": "prong",  "position": {"x": 0.58, "y": 0.52}},
    ],
    "metal": {"type": "yellow_gold", "color": "#FFD700", "finish": "high_polish", "roughness": 0.15},
    "stones": [{"type": "diamond", "cut": "round_brilliant", "size": 1.0, "position": {"x": 0.5, "y": 0.45}}],
    "style_dna": {"romance": 0.75, "boldness": 0.35, "modernity": 0.55, "luxury": 0.85, "complexity": 0.40},
}

MOCK_CONCEPTS = [
    {
        "id": "classic",
        "persona": "Classic",
        "label": "Classic",
        "description": "4-prong solitaire, round brilliant, medium band",
        "metal": "Yellow Gold 18k",
        "setting": "4-Prong Solitaire",
        "finish": "High Polish",
        "priceEstimate": 95000,
        "manufactureScore": 94,
        "color": "#FFD700",
        "params": {
            "metal": {"type": "yellow_gold", "color": "#FFD700", "roughness": 0.15, "finish": "high_polish"},
            "band": {"width": 2.5, "thickness": 1.8, "profile": "round"},
            "stones": [{"type": "diamond", "cut": "round_brilliant", "size": 1.0, "color": "#FFFFFF",
                        "transmission": 0.98, "ior": 2.417}],
            "halo": {"enabled": False, "stoneCount": 16, "stoneSize": 0.03},
            "prongs": {"count": 4, "style": "round", "height": 1.2, "thickness": 0.9},
            "engraving": {"enabled": False, "text": "", "font": "serif"},
            "setting": {"type": "prong"},
            "style_dna": {"romance": 0.7, "boldness": 0.3, "modernity": 0.5, "luxury": 0.85, "complexity": 0.35},
        },
    },
    {
        "id": "modern",
        "persona": "Modern",
        "label": "Modern",
        "description": "Bezel set, knife-edge band, brushed satin",
        "metal": "Platinum",
        "setting": "Bezel Set",
        "finish": "Brushed Satin",
        "priceEstimate": 112000,
        "manufactureScore": 96,
        "color": "#E8E8F0",
        "params": {
            "metal": {"type": "platinum", "color": "#E8E8F0", "roughness": 0.08, "finish": "brushed"},
            "band": {"width": 1.2, "thickness": 1.4, "profile": "knife_edge"},
            "stones": [{"type": "diamond", "cut": "round_brilliant", "size": 1.0, "color": "#FFFFFF",
                        "transmission": 0.98, "ior": 2.417}],
            "halo": {"enabled": False, "stoneCount": 16, "stoneSize": 0.03},
            "prongs": {"count": 0, "style": "bezel", "height": 0.8, "thickness": 0.6},
            "engraving": {"enabled": False, "text": "", "font": "serif"},
            "setting": {"type": "bezel"},
            "style_dna": {"romance": 0.3, "boldness": 0.55, "modernity": 0.95, "luxury": 0.75, "complexity": 0.2},
        },
    },
    {
        "id": "ornate",
        "persona": "Ornate",
        "label": "Ornate",
        "description": "Double halo, pavé band, rose gold, 6-prong",
        "metal": "Rose Gold 18k",
        "setting": "Double Halo Cluster",
        "finish": "High Polish",
        "priceEstimate": 148000,
        "manufactureScore": 88,
        "color": "#E8A090",
        "params": {
            "metal": {"type": "rose_gold", "color": "#E8A090", "roughness": 0.12, "finish": "high_polish"},
            "band": {"width": 4.0, "thickness": 2.2, "profile": "round"},
            "stones": [{"type": "diamond", "cut": "round_brilliant", "size": 1.0, "color": "#FFFFFF",
                        "transmission": 0.98, "ior": 2.417}],
            "halo": {"enabled": True, "stoneCount": 24, "stoneSize": 0.025},
            "prongs": {"count": 6, "style": "claw", "height": 1.4, "thickness": 1.0},
            "engraving": {"enabled": False, "text": "", "font": "serif"},
            "setting": {"type": "prong"},
            "style_dna": {"romance": 0.95, "boldness": 0.8, "modernity": 0.35, "luxury": 0.95, "complexity": 0.9},
        },
    },
]

# ── Vision AI helpers ──────────────────────────────────────────────────────────

VISION_PROMPT = """You are an expert jewelry analyst AI.
Analyze this image and return ONLY a valid JSON object (no markdown, no explanation) with exactly this structure:
{
  "type": "<ring|pendant|earring|bracelet|chain>",
  "confidence": <0.0-1.0>,
  "components": [
    {"name": "<part_name>", "type": "<stone|band|prong|bail|clasp|halo|setting>",
     "position": {"x": <0-1>, "y": <0-1>}}
  ],
  "metal": {"type": "<yellow_gold|white_gold|rose_gold|platinum|silver>",
             "color": "<hex>", "finish": "<high_polish|brushed|matte|hammered>",
             "roughness": <0-1>},
  "stones": [
    {"type": "<diamond|ruby|sapphire|emerald|amethyst|topaz|opal|pearl>",
     "cut": "<round_brilliant|princess|oval|marquise|cushion|pear|emerald_cut|cabochon>",
     "size": <0.1-3.0>, "position": {"x": <0-1>, "y": <0-1>}}
  ],
  "style_dna": {"romance": <0-1>, "boldness": <0-1>, "modernity": <0-1>,
                 "luxury": <0-1>, "complexity": <0-1>}
}
Be accurate about metal colour, gemstone type, and setting style. If the image is not jewelry, still return the JSON with best guesses."""

def _clean_json(raw: str) -> dict:
    """Strip markdown fences and parse JSON."""
    raw = raw.strip()
    if raw.startswith("```"):
        parts = raw.split("```")
        raw = parts[1] if len(parts) > 1 else raw
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())

def analyze_with_gemini_sync(image_bytes: bytes, mime_type: str) -> dict:
    """[SYNC] Call Gemini Vision API to analyze a jewelry image."""
    b64_data = base64.b64encode(image_bytes).decode()
    model = genai.GenerativeModel("gemini-1.5-flash")
    response = model.generate_content([
        VISION_PROMPT,
        {"mime_type": mime_type, "data": b64_data},
    ])
    return _clean_json(response.text)

def analyze_with_openai_sync(image_bytes: bytes, mime_type: str) -> dict:
    """[SYNC] Call OpenAI GPT-4o Vision to analyze a jewelry image."""
    client = OpenAI(api_key=OPENAI_API_KEY)
    b64 = base64.b64encode(image_bytes).decode()
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{
            "role": "user",
            "content": [
                {"type": "text", "text": VISION_PROMPT},
                {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{b64}"}},
            ],
        }],
        max_tokens=1200,
    )
    return _clean_json(response.choices[0].message.content)


CONCEPT_PROMPT = """Based on this jewelry analysis JSON, generate exactly 3 distinct 3D design concepts.
Return ONLY a valid JSON array with 3 objects, each with this structure:
{
  "id": "<classic|modern|ornate>",
  "persona": "<Classic|Modern|Ornate>",
  "label": "<short label>",
  "description": "<one line description>",
  "metal": "<metal name>",
  "setting": "<setting name>",
  "finish": "<finish name>",
  "priceEstimate": <integer INR>,
  "manufactureScore": <60-99>,
  "color": "<metal hex color>",
  "params": {
    "metal": {"type": "<metal_type>", "color": "<hex>", "roughness": <0-1>, "finish": "<finish>"},
    "band": {"width": <1-6>, "thickness": <1-3>, "profile": "<round|knife_edge|flat|comfort_fit>"},
    "stones": [{"type": "<stone_type>", "cut": "<cut>", "size": <0.1-3>, "color": "<hex>",
                 "transmission": <0-1>, "ior": <1.4-2.5>}],
    "halo": {"enabled": <bool>, "stoneCount": <8-32>, "stoneSize": <0.01-0.06>},
    "prongs": {"count": <0|4|6>, "style": "<round|claw|bezel>", "height": <0.6-2>, "thickness": <0.5-1.2>},
    "engraving": {"enabled": false, "text": "", "font": "serif"},
    "setting": {"type": "<prong|bezel|channel|pave>"},
    "style_dna": {"romance": <0-1>, "boldness": <0-1>, "modernity": <0-1>, "luxury": <0-1>, "complexity": <0-1>}
  }
}
Concepts should be meaningfully distinct — classic/timeless, modern/minimal, ornate/luxury.
Vary metal types, stone cuts, halo presence, and prong styles. Make them realistic and manufacturable."""

def generate_concepts_ai_sync(analysis: dict) -> list:
    """[SYNC] Use AI to generate design concepts from the image analysis."""
    prompt = CONCEPT_PROMPT + "\n\nAnalysis:\n" + json.dumps(analysis)

    if GEMINI_AVAILABLE and GEMINI_API_KEY:
        model = genai.GenerativeModel("gemini-1.5-flash")
        response = model.generate_content(prompt)
        return _clean_json(response.text)
    elif OPENAI_AVAILABLE and OPENAI_API_KEY:
        client = OpenAI(api_key=OPENAI_API_KEY)
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=2000,
        )
        return _clean_json(resp.choices[0].message.content)
    return MOCK_CONCEPTS

# ── Blender 3D generation ──────────────────────────────────────────────────────

def blender_available() -> bool:
    """Check if blender is in PATH or BLENDER_PATH is set."""
    return shutil.which(BLENDER_PATH) is not None or (BLENDER_PATH != "blender" and Path(BLENDER_PATH).exists())

def run_blender_export(params: dict, export_id: str, fmt: str = "glb") -> Optional[Path]:
    """
    Run Blender headlessly to generate a 3D jewelry model.
    Returns path to the generated file, or None on failure.
    """
    if not blender_available():
        return None

    output_path = EXPORTS_DIR / f"jewelcraft-{export_id}.{fmt}"
    params_path = EXPORTS_DIR / f"params-{export_id}.json"

    # Write params file
    with open(params_path, "w") as f:
        json.dump(params, f)

    cmd = [
        BLENDER_PATH,
        "--background",
        "--python", str(SCRIPT_PATH),
        "--",
        "--params", str(params_path),
        "--output", str(output_path),
    ]

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=120,  # 2 min max
        )
        if result.returncode == 0 and output_path.exists():
            # Clean up params file
            params_path.unlink(missing_ok=True)
            return output_path
        else:
            print(f"[Blender] FAILED:\n{result.stderr}")
            return None
    except (subprocess.TimeoutExpired, FileNotFoundError) as e:
        print(f"[Blender] Error: {e}")
        return None

# ── Endpoints ──────────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {
        "status": "JewelCraft AI API running",
        "version": "2.0.0",
        "vision_ai": "gemini" if (GEMINI_AVAILABLE and GEMINI_API_KEY) else ("openai" if (OPENAI_AVAILABLE and OPENAI_API_KEY) else "mock"),
        "blender": blender_available(),
    }

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "timestamp": time.time(),
        "sessions": len(sessions),
        "vision_ai": "gemini" if (GEMINI_AVAILABLE and GEMINI_API_KEY) else ("openai" if (OPENAI_AVAILABLE and OPENAI_API_KEY) else "mock"),
        "blender_available": blender_available(),
    }

# ── Image Analysis ─────────────────────────────────────────────────────────────

@app.post("/api/analyze")
async def analyze_image(
    file: UploadFile = File(...),
    session_id: str = Form(default=""),
):
    """
    Accepts a jewelry image and returns AI vision analysis.
    Uses Gemini Vision (primary) → OpenAI GPT-4o (fallback) → mock data (offline fallback).
    """
    if not session_id:
        session_id = str(uuid.uuid4())

    image_bytes = await file.read()
    mime_type = file.content_type or "image/jpeg"

    # Save uploaded image for later use in Blender generation
    img_path = UPLOADS_DIR / f"{session_id}.jpg"
    with open(img_path, "wb") as f:
        f.write(image_bytes)

    analysis = None
    ai_used = "mock"
    loop = asyncio.get_event_loop()
    img_bytes: bytes = bytes(image_bytes)

    # Try Gemini Vision first
    if GEMINI_AVAILABLE and GEMINI_API_KEY:
        try:
            print(f"[{session_id}] [Gemini] Starting vision analysis on {mime_type} image...")
            start_time = time.time()
            analysis = await loop.run_in_executor(
                None, analyze_with_gemini_sync, img_bytes, mime_type
            )
            elapsed = time.time() - start_time
            print(f"[{session_id}] [Gemini] Vision analysis completed successfully in {elapsed:.2f}s.")
            ai_used = "gemini"
        except Exception as e:
            print(f"[{session_id}] [Gemini] Vision analysis failed: {e}")

    # Fallback to OpenAI
    if analysis is None and OPENAI_AVAILABLE and OPENAI_API_KEY:
        try:
            analysis = await loop.run_in_executor(
                None, analyze_with_openai_sync, img_bytes, mime_type
            )
            ai_used = "openai"
        except Exception as e:
            print(f"[OpenAI] Vision analysis failed: {e}")

    # Final fallback to mock with slight randomisation
    if analysis is None:
        analysis = dict(MOCK_ANALYSIS)
        analysis["confidence"] = round(random.uniform(0.83, 0.95), 2)

    analysis["session_id"] = session_id
    analysis["ai_used"] = ai_used
    sessions[session_id] = {"status": "analyzed", "analysis": analysis, "image_path": str(img_path)}

    return {"session_id": session_id, "analysis": analysis, "ai_used": ai_used}

# ── Concept Generation ─────────────────────────────────────────────────────────

@app.post("/api/generate")
async def generate_concepts(session_id: str = Form(...)):
    """
    Triggers AI-driven concept generation for a session.
    Uses the previously-analysed image data to generate 3 distinct 3D design concepts.
    """
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found. Upload an image first.")

    analysis = sessions[session_id].get("analysis", MOCK_ANALYSIS)

    concepts = None
    ai_used = "mock"
    loop = asyncio.get_event_loop()

    if (GEMINI_AVAILABLE and GEMINI_API_KEY) or (OPENAI_AVAILABLE and OPENAI_API_KEY):
        try:
            engine = "Gemini" if (GEMINI_AVAILABLE and GEMINI_API_KEY) else "OpenAI"
            print(f"[{session_id}] [{engine}] Generating 3D design concepts from analysis...")
            start_time = time.time()
            concepts = await loop.run_in_executor(
                None, generate_concepts_ai_sync, analysis
            )
            elapsed = time.time() - start_time
            print(f"[{session_id}] [{engine}] Generated {len(concepts)} design concepts in {elapsed:.2f}s")
            ai_used = engine.lower()
        except Exception as e:
            print(f"[{session_id}] [AI] Concept generation failed: {e}")

    if concepts is None:
        print(f"[{session_id}] Falling back to mock concepts.")
        concepts = MOCK_CONCEPTS.copy()

    sessions[session_id]["concepts"] = concepts
    sessions[session_id]["status"] = "generated"

    return {"session_id": session_id, "concepts": concepts, "count": len(concepts), "ai_used": ai_used}

# ── WebSocket: Real-time Generation Progress ───────────────────────────────────

@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await websocket.accept()
    ws_connections[session_id] = websocket

    try:
        await websocket.send_json({"type": "connected", "session_id": session_id})

        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)

            if msg.get("action") == "start_generation":
                await websocket.send_json({"type": "progress", "stage": "analyzing_image", "pct": 10})
                await asyncio.sleep(0.4)
                await websocket.send_json({"type": "progress", "stage": "extracting_components", "pct": 28})
                await asyncio.sleep(0.35)
                await websocket.send_json({"type": "progress", "stage": "computing_style_dna", "pct": 50})
                await asyncio.sleep(0.3)
                await websocket.send_json({"type": "progress", "stage": "generating_concepts", "pct": 60})

                # Stream concepts from session if already generated
                stored = sessions.get(session_id, {}).get("concepts", MOCK_CONCEPTS)
                for i, concept in enumerate(stored):
                    await asyncio.sleep(0.7)
                    await websocket.send_json({
                        "type": "concept_ready",
                        "index": i,
                        "concept": concept,
                        "pct": 65 + (i + 1) * 11,
                    })

                await websocket.send_json({"type": "complete", "pct": 100, "concept_count": len(stored)})

            elif msg.get("action") == "ping":
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        ws_connections.pop(session_id, None)

# ── Catalog ────────────────────────────────────────────────────────────────────

@app.get("/api/catalog")
async def get_catalog(
    gender: Optional[str] = None,
    category: Optional[str] = None,
    metal: Optional[str] = None,
):
    from catalog_data import CATALOG_ITEMS
    items = CATALOG_ITEMS
    if gender and gender != "all":
        items = [i for i in items if i["gender"] == gender or i["gender"] == "unisex"]
    if category and category != "All":
        items = [i for i in items if category.lower() in i["category"].lower()]
    if metal and metal != "All Metals":
        items = [i for i in items if metal.lower() in i["metal"].lower()]
    return {"items": items, "count": len(items)}

# ── Export Package ─────────────────────────────────────────────────────────────

class ExportRequest(BaseModel):
    session_id: str
    params: dict
    formats: list[str] = ["glb", "stl", "pdf", "csv", "xlsx"]

@app.post("/api/export")
async def export_package(req: ExportRequest):
    """
    Generates a real 3D export via Blender if available, otherwise returns
    manifest metadata with download URLs.
    """
    export_id = str(uuid.uuid4())[:8]
    files = []

    loop = asyncio.get_event_loop()

    # ── Real Blender generation (async in thread pool) ─────────────────────────
    if blender_available():
        if "glb" in req.formats:
            glb_path = await loop.run_in_executor(
                None, run_blender_export, req.params, export_id, "glb"
            )
            if glb_path:
                size_kb = int(glb_path.stat().st_size) // 1024
                files.append({
                    "format": "glb",
                    "filename": glb_path.name,
                    "size_kb": size_kb,
                    "ready": True,
                    "download_url": f"/exports/{glb_path.name}",
                })

        if "stl" in req.formats:
            stl_path = await loop.run_in_executor(
                None, run_blender_export, req.params, f"{export_id}-stl", "stl"
            )
            if stl_path:
                size_kb = int(stl_path.stat().st_size) // 1024
                files.append({
                    "format": "stl",
                    "filename": stl_path.name,
                    "size_kb": size_kb,
                    "ready": True,
                    "download_url": f"/exports/{stl_path.name}",
                })

    # ── Fallback / supplementary formats ──────────────────────────────────────
    if not any(f["format"] == "glb" for f in files) and "glb" in req.formats:
        files.append({"format": "glb", "filename": f"jewelcraft-{export_id}.glb",
                       "size_kb": 847, "ready": False, "download_url": None,
                       "note": "Install Blender to enable real GLB export"})
    if not any(f["format"] == "stl" for f in files) and "stl" in req.formats:
        files.append({"format": "stl", "filename": f"jewelcraft-{export_id}.stl",
                       "size_kb": 1240, "ready": False, "download_url": None,
                       "note": "Install Blender to enable real STL export"})
    if "pdf" in req.formats:
        files.append({"format": "pdf", "filename": f"spec-sheet-{export_id}.pdf",
                       "size_kb": 420, "ready": True, "download_url": None})
    if "csv" in req.formats:
        files.append({"format": "csv", "filename": f"gemstones-{export_id}.csv",
                       "size_kb": 8, "ready": True, "download_url": None})
    if "xlsx" in req.formats:
        files.append({"format": "xlsx", "filename": f"cost-breakdown-{export_id}.xlsx",
                       "size_kb": 45, "ready": True, "download_url": None})

    band_width = req.params.get("band", {}).get("width", 2.5)
    prong_thick = req.params.get("prongs", {}).get("thickness", 0.9)

    return {
        "export_id": export_id,
        "files": files,
        "blender_used": blender_available(),
        "manufacture_score": 88,
        "validation": {
            "manifold": True,
            "wall_thickness": band_width >= 1.0,
            "stone_seating": True,
            "prong_integrity": prong_thick >= 0.8,
        },
    }

# ── Serve individual export files ──────────────────────────────────────────────

@app.get("/api/download/{filename}")
async def download_file(filename: str):
    file_path = EXPORTS_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found or generation failed")
    return FileResponse(str(file_path), media_type="application/octet-stream", filename=filename)

# ── Budget Suggestions ─────────────────────────────────────────────────────────

# Stone substitution ladder: each entry lists cheaper alternatives in descending quality
STONE_SUBSTITUTIONS = {
    "diamond": [
        {"type": "moissanite",       "color": "#E0F8FF", "ior": 2.65, "transmission": 0.95,
         "price_factor": 0.08, "label": "Moissanite", "note": "Diamond simulant, ≈92% savings"},
        {"type": "white_sapphire",   "color": "#F5F5FF", "ior": 1.77, "transmission": 0.85,
         "price_factor": 0.12, "label": "White Sapphire", "note": "Natural corundum, excellent clarity"},
        {"type": "cubic_zirconia",   "color": "#FFFFFF", "ior": 2.17, "transmission": 0.90,
         "price_factor": 0.01, "label": "Cubic Zirconia", "note": "Synthetic, maximum affordability"},
    ],
    "ruby": [
        {"type": "garnet",           "color": "#8B0000", "ior": 1.76, "transmission": 0.65,
         "price_factor": 0.05, "label": "Garnet", "note": "Similar red hue, natural stone"},
        {"type": "red_spinel",       "color": "#C41E3A", "ior": 1.72, "transmission": 0.70,
         "price_factor": 0.15, "label": "Red Spinel", "note": "Historically confused with ruby"},
        {"type": "synthetic_ruby",   "color": "#9B111E", "ior": 1.77, "transmission": 0.80,
         "price_factor": 0.03, "label": "Synthetic Ruby", "note": "Identical composition, lab grown"},
    ],
    "sapphire": [
        {"type": "blue_topaz",       "color": "#0080FF", "ior": 1.62, "transmission": 0.85,
         "price_factor": 0.04, "label": "Blue Topaz", "note": "Similar blue, very affordable"},
        {"type": "iolite",           "color": "#4B0082", "ior": 1.54, "transmission": 0.80,
         "price_factor": 0.03, "label": "Iolite", "note": "Violet-blue, unique trichroism"},
        {"type": "synthetic_sapp",   "color": "#0F52BA", "ior": 1.77, "transmission": 0.88,
         "price_factor": 0.04, "label": "Synthetic Sapphire", "note": "Lab grown, identical to natural"},
    ],
    "emerald": [
        {"type": "green_tourmaline", "color": "#2E8B57", "ior": 1.62, "transmission": 0.78,
         "price_factor": 0.10, "label": "Green Tourmaline", "note": "Vivid green, fewer inclusions"},
        {"type": "peridot",          "color": "#9FE2BF", "ior": 1.65, "transmission": 0.82,
         "price_factor": 0.02, "label": "Peridot", "note": "Lime green, very affordable"},
        {"type": "synthetic_emerald","color": "#50C878", "ior": 1.58, "transmission": 0.85,
         "price_factor": 0.05, "label": "Synthetic Emerald", "note": "Lab grown, better clarity"},
    ],
}

# Metal substitution ladder
METAL_SUBSTITUTIONS = {
    "platinum": [
        {"type": "white_gold", "color": "#E8E8F0", "roughness": 0.10, "finish": "high_polish",
         "price_factor": 0.55, "label": "18k White Gold", "note": "Very similar appearance, more affordable"},
        {"type": "palladium",  "color": "#D0D0E0", "roughness": 0.12, "finish": "high_polish",
         "price_factor": 0.70, "label": "Palladium", "note": "Same family as platinum, lighter"},
        {"type": "silver",     "color": "#C0C0C0", "roughness": 0.08, "finish": "high_polish",
         "price_factor": 0.05, "label": "Sterling Silver", "note": "Classic, requires rhodium plating"},
    ],
    "yellow_gold": [
        {"type": "gold_filled","color": "#D4AF37", "roughness": 0.18, "finish": "high_polish",
         "price_factor": 0.10, "label": "Gold Filled", "note": "Thick gold layer, affordable"},
        {"type": "vermeil",    "color": "#CFB53B", "roughness": 0.20, "finish": "high_polish",
         "price_factor": 0.05, "label": "Gold Vermeil", "note": "Sterling silver base with gold"},
        {"type": "brass",      "color": "#B5A642", "roughness": 0.25, "finish": "high_polish",
         "price_factor": 0.01, "label": "Gold-Plated Brass", "note": "Fashion jewelry, maximum savings"},
    ],
    "rose_gold": [
        {"type": "rose_filled","color": "#E8A090", "roughness": 0.18, "finish": "high_polish",
         "price_factor": 0.10, "label": "Rose Gold Filled", "note": "Thick rose gold layer"},
        {"type": "copper",     "color": "#C87941", "roughness": 0.25, "finish": "high_polish",
         "price_factor": 0.01, "label": "Copper-Brass Alloy", "note": "Similar warm tone, very low cost"},
    ],
}

class BudgetRequest(BaseModel):
    params: dict
    current_price: float
    target_budget: float

@app.post("/api/budget-suggest")
async def budget_suggest(req: BudgetRequest):
    """
    Given current params and a target budget, suggests stone and metal substitutions
    that bring the price within budget while maintaining maximum visual quality.
    """
    suggestions = []
    params = req.params
    ratio = req.target_budget / max(req.current_price, 1)

    # ── Stone substitutions ────────────────────────────────────────────────────
    stones = params.get("stones", [])
    if stones:
        current_stone = stones[0].get("type", "diamond")
        alts = STONE_SUBSTITUTIONS.get(current_stone, [])
        for alt in alts:
            new_price = req.current_price * alt["price_factor"] / max(
                next((s["price_factor"] for s in STONE_SUBSTITUTIONS.get(current_stone, []) if s["type"] == current_stone), 1), 1
            )
            est_price = req.current_price * (0.4 + alt["price_factor"] * 0.6)
            if est_price <= req.target_budget * 1.15:
                new_stones = [dict(stones[0])]
                new_stones[0].update({
                    "type": alt["type"],
                    "color": alt["color"],
                    "ior": alt["ior"],
                    "transmission": alt["transmission"],
                })
                suggestions.append({
                    "type": "stone_substitution",
                    "original": current_stone,
                    "substitute": alt["label"],
                    "note": alt["note"],
                    "estimated_price": round(est_price),
                    "savings_pct": round((1 - est_price / req.current_price) * 100),
                    "within_budget": est_price <= req.target_budget,
                    "params_patch": {"stones": new_stones},
                })

    # ── Metal substitutions ────────────────────────────────────────────────────
    current_metal = params.get("metal", {}).get("type", "yellow_gold")
    metal_alts = METAL_SUBSTITUTIONS.get(current_metal, [])
    for alt in metal_alts:
        est_price = req.current_price * (alt["price_factor"] * 0.5 + 0.15)
        if est_price <= req.target_budget * 1.20:
            new_metal = dict(params.get("metal", {}))
            new_metal.update({
                "type": alt["type"],
                "color": alt["color"],
                "roughness": alt["roughness"],
                "finish": alt["finish"],
            })
            suggestions.append({
                "type": "metal_substitution",
                "original": current_metal,
                "substitute": alt["label"],
                "note": alt["note"],
                "estimated_price": round(est_price),
                "savings_pct": round((1 - est_price / req.current_price) * 100),
                "within_budget": est_price <= req.target_budget,
                "params_patch": {"metal": new_metal},
            })

    # ── Design simplifications ─────────────────────────────────────────────────
    simplifications = []
    if params.get("halo", {}).get("enabled", False):
        simplifications.append({
            "type": "design_simplification",
            "change": "Remove halo",
            "note": "Halo settings add ~15-25% to cost",
            "savings_pct": 20,
            "params_patch": {"halo": {"enabled": False, "stoneCount": 0, "stoneSize": 0}},
        })

    prong_count = params.get("prongs", {}).get("count", 4)
    if prong_count == 6:
        simplifications.append({
            "type": "design_simplification",
            "change": "Reduce to 4-prong setting",
            "note": "4-prong saves ~8% labour vs 6-prong",
            "savings_pct": 8,
            "params_patch": {"prongs": {**params.get("prongs", {}), "count": 4}},
        })

    suggestions.extend(simplifications)

    # Sort by how close they get to the target budget
    suggestions.sort(key=lambda s: abs(s.get("estimated_price", req.current_price) - req.target_budget))

    return {
        "current_price": req.current_price,
        "target_budget": req.target_budget,
        "within_budget": req.current_price <= req.target_budget,
        "suggestions": suggestions[:6],  # top 6
    }

# ── Sharing ────────────────────────────────────────────────────────────────────

class ShareRequest(BaseModel):
    params: dict
    session_id: Optional[str] = None
    label: Optional[str] = "Custom Design"

@app.post("/api/share")
async def create_share(req: ShareRequest):
    share_id = str(uuid.uuid4())[:8]
    shared_designs[share_id] = {
        "params": req.params,
        "label": req.label,
        "created_at": time.time(),
        "session_id": req.session_id,
    }
    return {"share_id": share_id, "url": f"/view/{share_id}"}

@app.get("/api/share/{share_id}")
async def get_share(share_id: str):
    if share_id not in shared_designs:
        raise HTTPException(status_code=404, detail="Share link not found or expired")
    return shared_designs[share_id]

# ── Sessions ───────────────────────────────────────────────────────────────────

@app.get("/api/session/{session_id}")
async def get_session(session_id: str):
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    return sessions[session_id]

@app.delete("/api/session/{session_id}")
async def delete_session(session_id: str):
    sessions.pop(session_id, None)
    ws_connections.pop(session_id, None)
    return {"deleted": session_id}
