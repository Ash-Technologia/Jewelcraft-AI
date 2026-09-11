# 🚀 JewelCraft AI — Backend Deployment Guide

This guide provides step-by-step instructions for deploying the **JewelCraft AI FastAPI Backend** to modern cloud platforms: **Render**, **Railway**, **Google Cloud Run**, **Docker**, and **Linux VPS / AWS EC2**.

---

## 📋 Pre-Deployment Checklist

Before deploying, make sure you have the following credentials ready:

| Environment Variable | Required? | Source / How to Obtain |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | **Yes (Primary)** | [Google AI Studio](https://aistudio.google.com/apikey) (Free tier) |
| `HF_TOKEN` | **Yes (for 3D)** | [Hugging Face User Access Tokens](https://huggingface.co/settings/tokens) (Free tier with write access) |
| `GOLDAPI_KEY` | **Yes (Pricing)** | [GoldAPI.io](https://www.goldapi.io/dashboard) (Free tier: 100 req/mo) |
| `OPENAI_API_KEY` | Optional | [OpenAI API Keys](https://platform.openai.com/api-keys) (Fallback) |
| `ALLOWED_ORIGINS` | **Recommended** | Your production frontend URL (e.g. `https://your-app.vercel.app`) |
| `PORT` | Auto-set | Default `8000` (cloud providers usually override this automatically) |
| `HOST` | Default | `0.0.0.0` |

---

## 1. Deploying to Render.com (Recommended / Fastest)

Render offers free/low-cost Web Services with automated GitHub CI/CD deployments.

### Steps:
1. Go to [dashboard.render.com](https://dashboard.render.com/) and click **New +** $\rightarrow$ **Web Service**.
2. Connect your GitHub repository: `https://github.com/Ash-Technologia/Jewelcraft-AI`.
3. Configure the service:
   - **Name**: `jewelcraft-backend`
   - **Region**: Oregon (US West) or Frankfurt (EU)
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. In **Environment Variables**, add:
   ```env
   PYTHON_VERSION = 3.11.9
   GEMINI_API_KEY = your_gemini_api_key
   HF_TOKEN = your_hf_token
   GOLDAPI_KEY = your_goldapi_key
   ALLOWED_ORIGINS = https://your-frontend.vercel.app,http://localhost:5173
   ```
   > ⚠️ **CRITICAL for Render**: Setting `PYTHON_VERSION=3.11.9` tells Render to use Python 3.11 instead of Python 3.14. This ensures pre-compiled binary wheels are used for `pydantic-core` and prevents the `maturin / cargo failed (Read-only file system)` Rust compiler error.

5. Click **Create Web Service**.
6. Once deployed, verify your live health endpoint:
   `https://jewelcraft-backend.onrender.com/health`

---

## 2. Deploying to Railway.app

Railway detects the `backend/Dockerfile` automatically and provisions high-speed container execution.

### Steps:
1. Log in to [railway.app](https://railway.app/) and click **New Project** $\rightarrow$ **Deploy from GitHub repo**.
2. Select `Jewelcraft-AI`.
3. In settings:
   - **Root Directory**: Set to `/backend`
   - **Watch Paths**: `backend/**`
4. Under the **Variables** tab, add:
   - `GEMINI_API_KEY`
   - `HF_TOKEN`
   - `GOLDAPI_KEY`
   - `ALLOWED_ORIGINS`
5. Railway automatically builds using the `backend/Dockerfile` and exposes a secure `https://...up.railway.app` domain.

---

## 3. Deploying to Google Cloud Run (Serverless Container)

Ideal for autoscaling to zero when idle and instant scale-up on requests.

### Steps:
```bash
# 1. Login to Google Cloud
gcloud auth login
gcloud config set project YOUR_GCP_PROJECT_ID

# 2. Build and submit container image via Cloud Build
cd backend
gcloud builds submit --tag gcr.io/YOUR_GCP_PROJECT_ID/jewelcraft-backend

# 3. Deploy to Cloud Run
gcloud run deploy jewelcraft-backend \
    --image gcr.io/YOUR_GCP_PROJECT_ID/jewelcraft-backend \
    --platform managed \
    --region us-central1 \
    --allow-unauthenticated \
    --set-env-vars="GEMINI_API_KEY=YOUR_KEY,HF_TOKEN=YOUR_TOKEN,GOLDAPI_KEY=YOUR_KEY,ALLOWED_ORIGINS=*" \
    --memory 2Gi \
    --cpu 2
```

---

## 4. Deploying via Docker (Local, VPS, or AWS EC2)

The repository includes a production-grade `backend/Dockerfile`.

### Build & Run Container:
```bash
cd backend

# Build Docker image
docker build -t jewelcraft-backend .

# Run container with environment file
docker run -d \
    --name jewelcraft-api \
    -p 8000:8000 \
    --env-file .env \
    --restart unless-stopped \
    jewelcraft-backend
```

### Check Logs & Health:
```bash
docker logs -f jewelcraft-api
curl http://localhost:8000/health
```

---

## 5. Deploying to a Linux VPS (Ubuntu / Debian + Nginx + Systemd)

For running on a dedicated AWS EC2, DigitalOcean Droplet, or Linode instance:

### Step 1: Clone and install virtual environment
```bash
sudo apt update && sudo apt install -y python3-pip python3-venv nginx git

git clone https://github.com/Ash-Technologia/Jewelcraft-AI.git /var/www/jewelcraft
cd /var/www/jewelcraft/backend

python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
nano .env # Paste your API keys
```

### Step 2: Configure Systemd Service
Create `/etc/systemd/system/jewelcraft.service`:
```ini
[Unit]
Description=JewelCraft AI FastAPI Backend Daemon
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/jewelcraft/backend
Environment="PATH=/var/www/jewelcraft/backend/venv/bin"
ExecStart=/var/www/jewelcraft/backend/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000 --workers 3

Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```
Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now jewelcraft
sudo systemctl status jewelcraft
```

### Step 3: Nginx Reverse Proxy with SSL (Certbot)
Add to `/etc/nginx/sites-available/jewelcraft`:
```nginx
server {
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    client_max_body_size 25M;
}
```
Enable site and install free SSL certificate:
```bash
sudo ln -s /etc/nginx/sites-available/jewelcraft /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
sudo certbot --nginx -d api.yourdomain.com
```

---

## 🔒 Security & CORS Best Practices in Production

1. **Configure `ALLOWED_ORIGINS`**:
   In production, set `ALLOWED_ORIGINS` to only permit your verified frontend domains:
   ```env
   ALLOWED_ORIGINS=https://jewelcraft-ai.vercel.app,https://yourdomain.com
   ```
2. **Rate Limiting**:
   The built-in sliding window rate limiter protects endpoints from exhaustion (`10 req/min/IP`). You can configure this via:
   ```env
   RATE_LIMIT_PER_MINUTE=20
   ```
3. **Keep `.env` Secrets Private**:
   Never commit `.env` to GitHub. Always use your hosting provider's encrypted dashboard variables.

---

## 🩺 Verifying Production Health

Once deployed, query the health endpoint:
```bash
curl -X GET "https://api.yourdomain.com/health"
```
Expected Response:
```json
{
  "status": "ok",
  "sessions": 0,
  "vision_ai": "gemini",
  "blender_available": false,
  "goldapi_configured": true
}
```
Interactive Swagger OpenAPI documentation is available at:
`https://api.yourdomain.com/docs`
