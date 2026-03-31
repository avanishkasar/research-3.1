## ML-Research: Forecasting & Price Optimization

This repository contains both a Python backend (notebooks, data processing) and a React frontend (UI/dashboard).

### 🎯 Deployment

**Only the React frontend (`/frontend-react`) is deployed on Railway.**

### 📂 Project Structure

```
├── frontend-react/          # ← DEPLOYED ON RAILWAY
│   ├── app/
│   ├── components/
│   ├── package.json
│   ├── Dockerfile
│   └── railway.json
├── frontend/                # Streamlit app (local only)
├── notebooks/               # Jupyter notebooks
├── src/                     # Python utilities
├── data/                    # Sample datasets
└── Procfile                 # Railway config
```

### 🚀 Local Development

**Frontend (React):**
```bash
cd frontend-react
npm install
npm run dev
# Visit http://localhost:3000
```

**Backend (optional, local only):**
```bash
source .venv/bin/activate
streamlit run frontend/launch_optimizer_app.py
# Visit http://localhost:8501
```

### 🐳 Docker Deployment

From root or frontend-react directory:
```bash
docker build -f frontend-react/Dockerfile -t launch-optimizer .
docker run -p 3000:3000 launch-optimizer
```

### 📋 Railway Configuration

The `railway.json` at root level:
- Points to `frontend-react/Dockerfile`
- Sets build context to frontend-react
- Runs `npm run start` to launch the Next.js server

**Next.js must be built with `output: 'standalone'`** in `next.config.js` for Docker deployment.

### 🔗 Live URL

Once deployed: `https://ml-research-production.up.railway.app`
