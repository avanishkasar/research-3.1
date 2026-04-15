# Optezum - ML Research Forecasting Project

Optezum combines research notebooks (SARIMA/XGBoost + Google Trends) with a Next.js web app for interactive forecasting demos.

## Repository structure
- `notebooks/` - research pipeline (`01` to `06`) for data prep, SARIMA baseline, XGBoost with trends, and comparison.
- `src/` - Python helper scripts (synthetic sales generation and Google Trends fetching).
- `frontend-react/` - Next.js app used for UI interaction, CSV ingestion, and visual forecasting flow.
- `data/` - raw/processed project datasets and model result artifacts.

## Local development
### 1) Python environment
```bash
pip install -r requirements.txt
```

### 2) Frontend app
```bash
cd frontend-react
npm install
npm run dev
```

Open `http://localhost:3000`.

## Research vs app runtime
- Notebooks are the primary place where full research model training is performed.
- The frontend currently provides an interactive, CSV-driven demo pipeline and visual analytics experience.

## Deployment (Railway)
- Railway build uses root `Dockerfile`.
- Runtime settings are managed via root `railway.json`.
- Frontend assets and app source are under `frontend-react/`.

## Privacy and secrets
- Do not commit `.env`, credentials, API keys, or personal machine files.
- Existing `.gitignore` already excludes common private/local artifacts such as `.venv/`, `.env`, and `node_modules/`.
