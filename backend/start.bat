@echo off
echo ╔════════════════════════════════════════╗
echo ║    JewelCraft AI — Backend Server      ║
echo ╚════════════════════════════════════════╝
echo.

cd /d "%~dp0"

REM Check if uvicorn is installed
python -c "import uvicorn" 2>nul
if errorlevel 1 (
    echo [*] Installing dependencies...
    pip install -r requirements.txt
)

echo [*] Starting FastAPI server on http://localhost:8000
echo [*] API docs: http://localhost:8000/docs
echo.

python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
