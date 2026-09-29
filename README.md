# AI Answer Engine Tracking (GEO)
### Powered by FalconFace
> *"Track Your Brand. Measure AI Visibility. Understand Every Citation."*

**AI Answer Engine Tracking (GEO)** is a Generative Engine Optimization analytics SaaS platform engineered to monitor, analyze, and optimize your brand's presence across generative AI answer engines, including **Google AI Overviews**, **ChatGPT**, and **Perplexity**.

---

## 🚀 Key Features

- **Real-Time Share of Voice (SoV %)**: Continuously measures what percentage of AI-generated responses mention and recommend your brand.
- **Visibility Gap Index**: Identifies high-intent queries where competitors dominate AI citations and recommendations.
- **Dynamic Competitor Intelligence**: Configure custom competitor domains and track their citations against yours.
- **Citation Deep-Dive Audit**: Inspect every cited source URL, domain, and structural rank returned by AI engines.
- **7-Day Historical Trend Charts**: Visualize visibility trajectory and sentiment momentum over time.
- **Dual-Mode Persistence**: Zero-config deployment with automatic database seeding, plus seamless support for cloud PostgreSQL (Neon, Supabase).
- **Responsive SaaS UI**: Polished dark-slate interface with mobile drawer navigation, non-blocking toast notifications, and loading indicators.
- **Desktop & Web Coexistence**: Run as a standard web application, deploy to Vercel, or bundle as a desktop app with PyWebView.

---

## 🏗️ Architecture

```
                               [ Client Browser ]
                                       │
                    ┌──────────────────┴──────────────────┐
                    ▼                                     ▼
            /* (Static Assets)                   /api/* (REST Calls)
                    │                                     │
         [ Vercel Edge CDN ]                  [ Vercel Serverless Function ]
           (public/ folder)                         (api/index.py)
           - index.html                                   │
           - style.css                                    ▼
           - app.js                           [ FastAPI Engine (backend/) ]
                                                          │
                                               ┌──────────┴──────────┐
                                               ▼                     ▼
                                       [ Database Layer ]    [ Scraper & SERP ]
                                        - PostgreSQL (Cloud)  - SerpApi
                                        - SQLite (/tmp or     - Fallback Simulator
                                          local dev)
```

---

## ⚡ Quick Start: Deploy to Vercel (100% Free Tier)

### Option A: Deploy via GitHub (Recommended)

1. **Push your repository to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial FalconFace GEO commit"
   git remote add origin https://github.com/your-username/falconface-geo.git
   git branch -M main
   git push -u origin main
   ```

2. **Import into Vercel**:
   - Go to [vercel.com/new](https://vercel.com/new).
   - Select your GitHub repository.
   - Leave the Framework Preset as **Other** (Vercel automatically detects `vercel.json` and `api/index.py`).
   - Click **Deploy**.

3. **Your site is live!**
   - Vercel automatically deploys the frontend on its Edge CDN and provisions the FastAPI Python serverless function for `/api/*`.

---

### Option B: Deploy via Vercel CLI

```bash
# 1. Install Vercel CLI (if not already installed)
npm install -g vercel

# 2. Deploy directly from the project directory
vercel

# 3. For production deployment
vercel --prod
```

---

## 🔑 Environment Variables Configuration

Set these in the **Vercel Dashboard** under **Project Settings > Environment Variables** (or locally in `.env`):

| Variable | Description | Required? | Default / Fallback |
| :--- | :--- | :--- | :--- |
| `SERP_API_KEY` | SerpApi key to fetch real Google AI Overviews and organic citations. | Optional | If omitted, realistic heuristic simulation engine engages automatically. |
| `DATABASE_URL` | PostgreSQL connection string (Neon, Supabase, Railway) for permanent multi-region storage. | Optional | If omitted on Vercel, uses writable `/tmp/geo_tracker.db` pre-seeded with 7 days of logs. |
| `FRONTEND_DIR` | Custom path to static frontend assets. | Optional | Automatically detects `public/` then `frontend/`. |

---

## 💻 Local Development & Desktop Usage

### Running Locally as a Web Application
```bash
# 1. Install production dependencies
pip install -r requirements.txt

# 2. Start the local FastAPI server
uvicorn backend.main:app --reload --port 8000

# 3. Open http://127.0.0.1:8000 in your browser
```

### Running Locally as a Desktop App
```bash
# 1. Install desktop requirements (including PyWebView)
pip install -r requirements-desktop.txt

# 2. Launch the desktop GUI
python desktop_app.py
```

### Running the Smoke Test Suite
```bash
python test_smoke.py
```

---

## 📄 License & Attribution
**FalconFace GEO** — Engineered for Generative Engine Optimization analytics.
