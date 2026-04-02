# Optezum - Frontend React

Reactive UI for demand forecasting and price optimization using ARIMA, SARIMA, and XGBoost models.

## Local Development

```bash
cd frontend-react
npm install
npm run dev
```

Visit `http://localhost:3000`

## Deployment

### Railway (Recommended)

1. Push to GitHub
2. Connect repo to Railway
3. Select this `/frontend-react` directory as the root
4. Railway will auto-detect Dockerfile and deploy

```bash
# Or deploy from CLI:
railway up
```

### Docker (Local)

```bash
docker build -t launch-optimizer .
docker run -p 3000:3000 launch-optimizer
```

### Vercel

```bash
vercel deploy
```

## Environment Variables

Create `.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Features

- Interactive demand forecasting charts
- Model comparison (ARIMA vs XGBoost)
- Google Trends integration
- Revenue optimization curves
- CSV upload and processing
- Real-time pipeline progress tracking
- Responsive mobile-first design
- Gradient wave animations
- Framer Motion animations

## Tech Stack

- Next.js 14 + React 18
- TypeScript
- Tailwind CSS
- Plotly.js for charts
- Framer Motion for animations
- Radix UI components
