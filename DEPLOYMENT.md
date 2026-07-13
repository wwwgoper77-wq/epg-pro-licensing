# EPG-PRO Licensing Server - Production Deployment Guide

This guide details step-by-step instructions for deploying the EPG-PRO Licensing Server to modern hosting platforms including **Google Cloud Run**, **Railway**, and **Render**. 

The server is a unified full-stack application. It compiles the React/Vite front-end administration dashboard into static assets served by a fast, light Express.js server on Node.js.

---

## 📋 Table of Contents
1. [Core Features & Architecture](#-core-features--architecture)
2. [Environment Configuration](#-environment-configuration)
3. [Method 1: Deploying to Google Cloud Run (Recommended)](#method-1-deploying-to-google-cloud-run-recommended)
4. [Method 2: Deploying to Railway](#method-2-deploying-to-railway)
5. [Method 3: Deploying to Render](#method-3-deploying-to-render)
6. [Data Persistence & Scaling](#-data-persistence--scaling)

---

## 🏗️ Core Features & Architecture

- **Multi-Stage Dockerfile**: The container is fully optimized. The first build stage compiles the TypeScript frontend/backend. The second runtime stage copies *only* the compiled Javascript, the production static site assets, and production node dependencies, minimizing boot-up latency (cold starts).
- **Embedded Python Packager**: The server stores `/arabic_epg_protected.zip` directly in its workspace. When requested, Enigma2 clients can automatically download the latest protected client plugin directly from the `/api/download/zip` endpoint.
- **State Serialization**: License states and active logs are stored inside a light local JSON document (`licenses.json`). This ensures high reliability and zero database overhead.

---

## ⚙️ Environment Configuration

You must define the following environment variables on your cloud provider's dashboard:

| Variable | Description | Default / Example | Required |
| :--- | :--- | :--- | :--- |
| `PORT` | Container binding port | `3000` | Yes |
| `APP_URL` | Deployed URL of your server (e.g. `https://my-epg-pro.up.railway.app`) | `http://your-app-domain.com` | Yes |
| `SIGNATURE_SECRET` | Cryptographic signature key (Must match client's `SECRET_SALT`) | `EPG_ARABIC_SECRET_2026` | Yes |
| `ADMIN_USERNAME` | Administrator dashboard username | `admin` | Yes |
| `ADMIN_PASSWORD` | Administrator dashboard password | `admin` (Change immediately!) | Yes |
| `ADMIN_SESSION_SECRET` | Secret salt used for hashing administrator session tokens | `EPG_SESSION_2026` | Yes |
| `DB_PATH` | Path to persistent storage JSON database | `./licenses.json` | Yes |

---

## 🚀 Method 1: Deploying to Google Cloud Run (Recommended)

Google Cloud Run is highly recommended for serverless Docker deployments due to near-zero idle cost, auto-scaling, and secure ingress handling.

### Prerequisites:
1. Install [Google Cloud SDK](https://cloud.google.com/sdk/docs/install).
2. Authenticate: `gcloud auth login`
3. Set your active project: `gcloud config set project <YOUR_PROJECT_ID>`

### Steps:
1. **Submit the Docker image to Google Artifact Registry**:
   ```bash
   gcloud builds submit --tag gcr.io/<YOUR_PROJECT_ID>/epg-pro-server
   ```
2. **Deploy the container to Cloud Run**:
   ```bash
   gcloud run deploy epg-pro-server \
     --image gcr.io/<YOUR_PROJECT_ID>/epg-pro-server \
     --platform managed \
     --region europe-west2 \
     --allow-unauthenticated \
     --port 3000 \
     --set-env-vars="SIGNATURE_SECRET=EPG_ARABIC_SECRET_2026,ADMIN_USERNAME=admin,ADMIN_PASSWORD=your_secure_password,ADMIN_SESSION_SECRET=secure_session_salt"
   ```
3. Copy the secure `https://...` URL returned by Cloud Run. This is your live EPG-PRO server endpoint!

---

## 🚂 Method 2: Deploying to Railway

Railway is a developer-friendly platform that deploys directly from Github or using the Railway CLI. It automatically parses our `Dockerfile` and builds the service.

### Method A: Deploy from GitHub
1. Create a new GitHub repository and push this project's code.
2. Open [Railway Dashboard](https://railway.app) and click **New Project** -> **Deploy from GitHub**.
3. Select your repository.
4. Click on **Variables** and add the environment configurations listed in [Environment Configuration](#-environment-configuration).
5. Click **Settings** -> **Generate Domain** to get a public `https://...` URL.

### Method B: Deploy from CLI
1. Install CLI: `npm i -g @railway/cli`
2. Login: `railway login`
3. Link project: `railway link`
4. Deploy: `railway up`

---

## ☁️ Method 3: Deploying to Render

Render is another popular fully-managed cloud platform with native support for Docker Web Services.

1. Create a Render account at [Render.com](https://render.com).
2. Click **New +** -> **Web Service**.
3. Connect your GitHub repository.
4. Set the following settings:
   - **Language**: `Docker`
   - **Branch**: `main`
5. Scroll down to **Advanced** -> **Add Environment Variables** and add your production credentials and secrets.
6. Click **Create Web Service**. Render will automatically trigger the multi-stage Docker build and deploy it publicly.

---

## 💾 Data Persistence & Scaling

Because the server uses `licenses.json` as a lightweight file database, please keep the following scaling constraints in mind:

- **Single Instance Constraint**: You should deploy the server with **Max Instances = 1** (or non-replicated containers) to avoid file write race conditions. 
- **Persistent Volumes**: On Railway and Render, you can mount a persistent volume/disk to `/app` (or change `DB_PATH` to mount to your persistent disk mount e.g. `/data/licenses.json`) to prevent database loss whenever the container restarts or gets redeployed.
  - On Render, add a **Disk** under settings, mount it to `/data`, and set `DB_PATH=/data/licenses.json` in your Environment Variables.
  - On Cloud Run, you can map Google Cloud Storage (GCS) or a Cloud Filestore volume, or simply rely on standard SQLite-like JSON workflows if redeploys are infrequent and backed up.
