# ⚡ JewelCraft AI — Vercel Frontend Deployment & Backend Linking Guide

This guide explains how to link and deploy your **JewelCraft AI Frontend on Vercel** to communicate seamlessly with your deployed backend on **Render**, **Railway**, or **Cloud Run**.

---

## 🔗 The Two-Way Connection Overview

For your frontend and backend to communicate across the web, two configurations are needed:

```
┌────────────────────────────────────────┐                ┌────────────────────────────────────────┐
│             Vercel Frontend            │                │             Render Backend             │
│   https://jewelcraft-ai.vercel.app     │ ─────────────► │   https://jewelcraft-api.onrender.com  │
│                                        │                │                                        │
│  Environment Variable:                 │                │  Environment Variable:                 │
│  VITE_API_URL =                        │                │  ALLOWED_ORIGINS =                     │
│  https://jewelcraft-api.onrender.com   │ ◄───────────── │  https://jewelcraft-ai.vercel.app      │
└────────────────────────────────────────┘   CORS Policy  └────────────────────────────────────────┘
```

1. **Frontend $\rightarrow$ Backend**: The Vercel app needs `VITE_API_URL` pointing to your live backend domain.
2. **Backend $\rightarrow$ Frontend (CORS)**: The Render backend needs `ALLOWED_ORIGINS` allowing requests from your Vercel domain.

---

## Step 1: Configure Environment Variables in Vercel

1. Go to your [Vercel Dashboard](https://vercel.com/dashboard) and select your **JewelCraft AI** project.
2. Click **Settings** (top navigation) $\rightarrow$ **Environment Variables** (left sidebar).
3. Add the following environment variable:

| Key | Value | Notes |
| :--- | :--- | :--- |
| **`VITE_API_URL`** | `https://your-backend.onrender.com/api` | Replace with your live Render backend URL |
| **`VITE_WS_URL`** *(Optional)* | `wss://your-backend.onrender.com/ws` | Auto-derived from `VITE_API_URL` if omitted |

> 💡 **Smart Normalization**: You can enter either `https://your-backend.onrender.com` or `https://your-backend.onrender.com/api`. The API client automatically normalizes endpoints and resolves 3D GLB/OBJ download assets.

4. Make sure **Production**, **Preview**, and **Development** checkboxes are selected.
5. Click **Save**.

---

## Step 2: Allow Vercel Domain in Render (CORS)

If your backend is on Render:

1. Go to your [Render Dashboard](https://dashboard.render.com/) $\rightarrow$ Select your `jewelcraft-backend` Web Service.
2. Go to the **Environment** tab.
3. Find or add the **`ALLOWED_ORIGINS`** variable:
   ```env
   ALLOWED_ORIGINS = https://your-project-name.vercel.app,http://localhost:5173
   ```
   *(If you have a custom domain on Vercel, e.g. `https://jewelcraft.com`, include it separated by commas).*
4. Click **Save Changes**. Render will automatically restart your service with the new CORS origin policy in ~10 seconds.

---

## Step 3: Trigger a Redeploy on Vercel

Since Vite embeds `import.meta.env.VITE_*` variables at **build time**, you must trigger a redeployment for the new backend URL to take effect:

1. In Vercel, go to the **Deployments** tab.
2. Click the three dots `...` next to your latest deployment $\rightarrow$ Select **Redeploy**.
3. (Alternatively, push a new commit to your `main` branch to trigger an automatic deployment).

---

## Step 4: Client-Side Routing (SPA Refresh Fix)

The repository includes a [`frontend/vercel.json`](file:///c:/Users/user/.gemini/antigravity-ide/scratch/Jewelcraft-AI/frontend/vercel.json) file:
```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```
This ensures that refreshing directly on routes like `/generate`, `/designer`, or `/export` renders the page immediately instead of returning a `404 Not Found`.

---

## Step 5: Verification & Testing

1. Open your live Vercel URL (e.g., `https://your-app.vercel.app/generate`).
2. Open your browser DevTools (**F12** $\rightarrow$ **Console** & **Network** tabs).
3. Click the **`Ring`** or **`Pendant`** button under *"Try Real Sample"*.
4. Verify:
   - Network requests fire to `https://your-backend.onrender.com/api/analyze` (Status: `200 OK`).
   - The 3D model loads into the Haute Joaillerie canvas from `https://your-backend.onrender.com/exports/...glb`.
   - The live spot valuation chips fetch gold rates from `https://your-backend.onrender.com/api/metal-prices`.
