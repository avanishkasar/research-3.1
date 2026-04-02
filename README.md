# ML Research Forecast Studio

This repository contains a forecasting research project that combines sales data, Google Trends signals, and interactive analytics.

## What’s inside
- Python notebooks and scripts for data preparation and forecasting
- A React/Next.js frontend in `frontend-react`
- Deployment files for Railway and Docker

## Run locally
```bash
pip install -r requirements.txt
cd frontend-react
npm install
npm run dev
```

## Build and deploy
- Railway uses the root `Dockerfile`.
- The frontend app is built from `frontend-react`.

## Main project areas
- `src/` for Python scripts
- `notebooks/` for analysis
- `frontend-react/` for the UI
- `data/` for datasets and outputs
