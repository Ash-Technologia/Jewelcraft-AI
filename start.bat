@echo off
title JewelCraft AI — Dev Server

echo.
echo ══════════════════════════════════════════════════
echo   JewelCraft AI — Starting Development Environment
echo ══════════════════════════════════════════════════
echo.

REM ── Check Python ──
python --version >nul 2>&1 || (
    echo [ERROR] Python not found. Install Python 3.10+ and add to PATH.
    pause & exit /b 1
)

REM ── Check Node ──
node --version >nul 2>&1 || (
    echo [ERROR] Node.js not found. Install Node.js 18+ from https://nodejs.org
    pause & exit /b 1
)

REM ── Create backend .env if missing ──
if not exist "backend\.env" (
    echo [Setup] Creating backend\.env from template...
    copy "backend\.env.example" "backend\.env" >nul
    echo [Setup] ^^^! Edit backend\.env and add your GEMINI_API_KEY for AI features.
)

REM ── Create frontend .env if missing ──
if not exist "frontend\.env" (
    echo [Setup] Creating frontend\.env from template...
    copy "frontend\.env.example" "frontend\.env" >nul
)

REM ── Install backend deps ──
echo [Backend] Installing Python dependencies...
cd backend
python -m pip install -r requirements.txt --quiet --no-warn-script-location
cd ..

REM ── Install frontend deps ──
echo [Frontend] Installing Node dependencies...
cd frontend
if not exist "node_modules" (
    npm install --silent
)
cd ..

echo.
echo [Starting] Launching backend on http://localhost:8000
echo [Starting] Launching frontend on http://localhost:5173
echo.
echo   API Docs: http://localhost:8000/docs
echo   Health:   http://localhost:8000/health
echo.
echo Press Ctrl+C in each window to stop.
echo.

REM ── Start backend in new terminal ──
start "JewelCraft Backend" cmd /k "cd /d backend && python -m uvicorn main:app --reload --port 8000 --host 0.0.0.0"

REM ── Give backend a moment to start ──
timeout /t 2 /nobreak >nul

REM ── Start frontend ──
start "JewelCraft Frontend" cmd /k "cd /d frontend && npm run dev"

echo [Ready] Both servers are starting up...
echo         Open http://localhost:5173 in your browser.
pause
