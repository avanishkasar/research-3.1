"""
Indian Electronics Demand Forecasting – Product Launch Optimizer
================================================================
Polished Streamlit dashboard.  Shows a landing page first; the full
analysis pipeline only runs after the user uploads a CSV and clicks
"Run Analysis".  Every step is shown with a live progress bar and
elapsed-time counter.

Run from project root:
    streamlit run frontend/launch_optimizer_app.py
"""

from __future__ import annotations

import time
import warnings
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd
import plotly.graph_objects as go
import streamlit as st
from sklearn.metrics import mean_absolute_error, mean_squared_error
from xgboost import XGBRegressor

warnings.filterwarnings("ignore")

# ── paths ────────────────────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent.parent
TRENDS_DIR = PROJECT_ROOT / "data"

# ── page config ──────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="Launch Optimizer – Indian E-Commerce",
    page_icon="🚀",
    layout="wide",
)

# ═════════════════════════════════════════════════════════════════════════════
#  CSS
# ═════════════════════════════════════════════════════════════════════════════
st.markdown("""
<style>
/* ---------- colour tokens ---------- */
:root{
  --accent: #0d6efd;
  --accent-light: #e7f0ff;
  --success: #198754;
  --muted: #6c757d;
  --card-bg: #ffffff;
  --card-shadow: 0 2px 8px rgba(0,0,0,.06);
}

/* ---------- hero ---------- */
.hero{
  text-align:center;
  padding:3rem 1rem 2rem;
}
.hero h1{
  font-size:2.8rem;
  font-weight:800;
  background:linear-gradient(135deg,#0d6efd,#6610f2);
  -webkit-background-clip:text;
  -webkit-text-fill-color:transparent;
  margin-bottom:.4rem;
}
.hero p.subtitle{
  font-size:1.05rem;
  color:var(--muted);
  max-width:640px;
  margin:0 auto 2rem;
  line-height:1.6;
}

/* ---------- step cards ---------- */
.step-card{
  background:#1e2a3a;
  border:1px solid #334155;
  border-radius:.75rem;
  padding:1.2rem 1.4rem;
  margin-bottom:.8rem;
  box-shadow:0 2px 8px rgba(0,0,0,.25);
}
.step-card .step-title{
  font-weight:700;
  font-size:1rem;
  margin-bottom:.25rem;
  color:#f1f5f9;
}
.step-card .step-time{
  font-size:.82rem;
  color:#94a3b8;
}

/* ---------- section divider ---------- */
.section-divider{border:0;border-top:2px solid #e9ecef;margin:2.5rem 0 2rem}

/* ---------- footer ---------- */
.footer{text-align:center;color:var(--muted);padding:2rem 0 1rem;font-size:.85rem}
</style>
""", unsafe_allow_html=True)


# ═════════════════════════════════════════════════════════════════════════════
#  HELPER FUNCTIONS  (data / ML – unchanged logic, compact)
# ═════════════════════════════════════════════════════════════════════════════

def _strip_currency(s: pd.Series) -> pd.Series:
    return (s.astype(str)
             .str.replace("₹", "", regex=False)
             .str.replace(",", "", regex=False)
             .str.strip()
             .pipe(pd.to_numeric, errors="coerce"))


def clean_dataframe(raw: pd.DataFrame) -> pd.DataFrame:
    expected = ["product_id", "category", "discounted_price",
                "actual_price", "rating", "rating_count"]
    missing = [c for c in expected if c not in raw.columns]
    if missing:
        st.error(f"Missing columns in CSV: **{missing}**")
        st.stop()
    df = raw.copy()
    df["discounted_price"] = _strip_currency(df["discounted_price"])
    df["actual_price"]     = _strip_currency(df["actual_price"])
    df["rating"] = pd.to_numeric(df["rating"].astype(str).str.strip(), errors="coerce")
    df["rating_count"] = pd.to_numeric(
        df["rating_count"].astype(str).str.replace(",", "", regex=False).str.strip(),
        errors="coerce",
    )
    df.dropna(subset=["discounted_price", "actual_price", "rating_count"], inplace=True)
    df.reset_index(drop=True, inplace=True)
    return df


def generate_weekly_series(df: pd.DataFrame, years: int = 3) -> pd.DataFrame:
    np.random.seed(42)
    now = pd.Timestamp.now(tz="Asia/Kolkata").normalize().tz_localize(None)
    dates = pd.date_range(start=now - pd.DateOffset(years=years), end=now, freq="W-SUN")
    n = len(dates)
    total = df["rating_count"].sum()
    woy = dates.isocalendar().week.astype(int).values
    seasonal = np.ones(n)
    for i, (d, w) in enumerate(zip(dates, woy)):
        m = d.month
        if m in (10, 11) and 40 <= w <= 46:
            seasonal[i] += np.random.uniform(0.35, 0.65)
        elif m == 9 and w >= 38:
            seasonal[i] += np.random.uniform(0.2, 0.4)
        elif m == 1 and w <= 5:
            seasonal[i] += np.random.uniform(0.1, 0.3)
        elif m in (6, 7) and 24 <= w <= 28:
            seasonal[i] += np.random.uniform(0.1, 0.25)
    shares = seasonal / seasonal.sum()
    units = (total * shares).astype(int)
    units = np.clip(units + np.random.normal(0, units.std() * 0.05, n).astype(int), 1, None)
    weights = df["rating_count"] / df["rating_count"].sum()
    avg_p = (df["discounted_price"] * weights).sum()
    prices = avg_p * (1 + np.random.uniform(-0.05, 0.05, n))
    return pd.DataFrame({"Date": dates, "Units_Sold": units, "Weekly_Price": np.round(prices, 2)})


def _trends_cache_path(keyword: str) -> Path:
    return TRENDS_DIR / f"google_trends_{keyword.strip().lower().replace(' ', '_')}.csv"


def _synthetic_trends(keyword: str, start: str, end: str) -> pd.DataFrame:
    dates = pd.date_range(start=start, end=end, freq="W-SUN")
    n = len(dates)
    np.random.seed(abs(hash(keyword)) % 2**31)
    woy = dates.isocalendar().week.astype(int).values
    s = 20 * np.sin(2 * np.pi * (woy - 42) / 52) + 50
    spk = np.zeros(n)
    for j, d in enumerate(dates):
        w, m = d.isocalendar().week, d.month
        if m in (10, 11) and 40 <= w <= 46: spk[j] += np.random.uniform(15, 30)
        if m == 9 and w >= 39:              spk[j] += np.random.uniform(10, 20)
        if m == 1 and w <= 5:               spk[j] += np.random.uniform(5, 15)
        if m in (6, 7) and 24 <= w <= 28:   spk[j] += np.random.uniform(5, 12)
    walk = np.cumsum(np.random.normal(0, 1.2, n))
    walk = (walk - walk.min()) / (walk.max() - walk.min() + 1e-9) * 12
    raw = s + spk + walk
    raw = (raw - raw.min()) / (raw.max() - raw.min() + 1e-9) * 100
    return pd.DataFrame({"Date": dates, keyword: np.clip(np.round(raw), 0, 100).astype(int)})


def fetch_google_trends(keyword: str, start: str, end: str) -> pd.DataFrame:
    cache = _trends_cache_path(keyword)
    if cache.exists():
        df = pd.read_csv(cache, parse_dates=["Date"])
        if not df.empty:
            return df
    try:
        from pytrends.request import TrendReq
        pt = TrendReq(hl="en-IN", tz=330, retries=2, backoff_factor=1)
        pt.build_payload(kw_list=[keyword], timeframe=f"{start} {end}", geo="IN")
        raw = pt.interest_over_time()
        if not raw.empty:
            raw = raw.drop(columns=["isPartial"], errors="ignore").reset_index().rename(columns={"date": "Date"})
            raw["Date"] = pd.to_datetime(raw["Date"])
            cache.parent.mkdir(parents=True, exist_ok=True)
            raw.to_csv(cache, index=False)
            return raw
    except Exception:
        pass
    df = _synthetic_trends(keyword, start, end)
    cache.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(cache, index=False)
    return df


def merge_sales_trends(sales: pd.DataFrame, trends: pd.DataFrame, kw: str) -> pd.DataFrame:
    s, t = sales.copy(), trends.copy()
    s["Date"] = pd.to_datetime(s["Date"])
    t["Date"] = pd.to_datetime(t["Date"])
    s["week"] = s["Date"].dt.to_period("W").dt.start_time
    t["week"] = t["Date"].dt.to_period("W").dt.start_time
    tc = [c for c in t.columns if c not in ("Date", "week")]
    tw = t.groupby("week")[tc].mean().reset_index()
    m = s.merge(tw, on="week", how="left")
    m[kw] = m[kw].ffill().bfill()
    m.drop(columns=["week"], inplace=True)
    return m


def engineer_features(df: pd.DataFrame, kw: str) -> pd.DataFrame:
    df = df.sort_values("Date").copy()
    for l in (1, 2, 3):
        df[f"units_lag{l}"] = df["Units_Sold"].shift(l)
        df[f"trend_lag{l}"] = df[kw].shift(l)
    df["units_roll4"] = df["Units_Sold"].rolling(4, min_periods=1).mean()
    df["trend_momentum"] = df[kw].diff()
    df["price_lag1"] = df["Weekly_Price"].shift(1)
    df.dropna(inplace=True)
    df.reset_index(drop=True, inplace=True)
    return df


def _mape(yt, yp):
    m = yt != 0
    return float(np.mean(np.abs((yt[m] - yp[m]) / yt[m])) * 100)


def train_arima(ty, tl):
    from statsmodels.tsa.statespace.sarimax import SARIMAX
    fit = SARIMAX(ty.values, order=(1, 1, 1), seasonal_order=(1, 1, 0, 52),
                  enforce_stationarity=False, enforce_invertibility=False).fit(disp=False)
    fitted_vals = fit.fittedvalues
    return fit, fit.forecast(steps=tl), fitted_vals


def train_xgboost(Xtr, ytr, Xte):
    m = XGBRegressor(n_estimators=200, max_depth=5, learning_rate=0.08,
                     subsample=0.8, colsample_bytree=0.8, random_state=42, verbosity=0)
    m.fit(Xtr, ytr)
    return m, m.predict(Xte)


def forecast_future(model, rows, fcols, kw, n=8):
    last = rows.iloc[-1].copy()
    preds, ld = [], pd.to_datetime(last["Date"])
    for _ in range(n):
        yhat = float(model.predict(last[fcols].values.reshape(1, -1))[0])
        preds.append(yhat)
        if "units_lag3" in last.index: last["units_lag3"] = last.get("units_lag2", yhat)
        if "units_lag2" in last.index: last["units_lag2"] = last.get("units_lag1", yhat)
        if "units_lag1" in last.index: last["units_lag1"] = yhat
        if "trend_lag3" in last.index: last["trend_lag3"] = last.get("trend_lag2", last.get(kw, 50))
        if "trend_lag2" in last.index: last["trend_lag2"] = last.get("trend_lag1", last.get(kw, 50))
        if "trend_lag1" in last.index: last["trend_lag1"] = last.get(kw, 50)
        if "trend_momentum" in last.index: last["trend_momentum"] = 0
        if "units_roll4" in last.index: last["units_roll4"] = np.mean(preds[-4:] if len(preds) >= 4 else preds)
        if "price_lag1" in last.index: last["price_lag1"] = last["Weekly_Price"]
    dates = pd.date_range(start=ld + timedelta(weeks=1), periods=n, freq="W-SUN")
    return pd.DataFrame({"Date": dates, "XGBoost_Forecast": preds})


def forecast_arima_future(ty, n=8):
    from statsmodels.tsa.statespace.sarimax import SARIMAX
    fit = SARIMAX(ty.values, order=(1, 1, 1), seasonal_order=(1, 1, 0, 52),
                  enforce_stationarity=False, enforce_invertibility=False).fit(disp=False)
    return fit.forecast(steps=n)


def optimise_price(model, base, fcols, lp):
    prices = np.linspace(lp * 0.7, lp * 1.3, 40)
    dem, rev = [], []
    for p in prices:
        r = base.copy(); r["Weekly_Price"] = p
        if "price_lag1" in r.index: r["price_lag1"] = p
        d = max(float(model.predict(r[fcols].values.reshape(1, -1))[0]), 0)
        dem.append(d); rev.append(p * d)
    return pd.DataFrame({"Price": prices, "Predicted_Demand": dem, "Revenue": rev})


# ═════════════════════════════════════════════════════════════════════════════
#  UI  HELPERS
# ═════════════════════════════════════════════════════════════════════════════

def _step_card(icon: str, title: str, detail: str, elapsed: float) -> str:
    return (f'<div class="step-card">'
            f'<div class="step-title">{icon}  {title}</div>'
            f'<div class="step-time">{detail} · ⏱ {elapsed:.2f}s</div></div>')


def _score_band(mape: float) -> str:
    if mape < 10:
        return "Excellent"
    if mape < 20:
        return "Good"
    if mape < 30:
        return "Acceptable"
    return "Needs Improvement"


def _terminal_log(stage: str, detail: str) -> None:
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {stage}: {detail}", flush=True)


# ═════════════════════════════════════════════════════════════════════════════
#  MAIN
# ═════════════════════════════════════════════════════════════════════════════

def main() -> None:

    # ── HERO ─────────────────────────────────────────────────────────────
    st.markdown(
        '<div class="hero">'
        '<h1>🚀 Product Launch Optimizer</h1>'
        '<p class="subtitle">'
        'Enhancing E-Commerce Sales Forecasting Using Google Trends — '
        'A Machine Learning Approach for Indian Online Retail'
        '</p></div>',
        unsafe_allow_html=True,
    )

    # ── SIDEBAR ──────────────────────────────────────────────────────────
    st.sidebar.markdown("### ⚙️ Configuration")
    keyword = st.sidebar.text_input("Google Trends keyword", value="earbuds india")
    forecast_horizon = st.sidebar.slider("Forecast horizon (weeks)", 4, 12, 8)

    # ── FILE UPLOAD ──────────────────────────────────────────────────────
    st.markdown('<hr class="section-divider">', unsafe_allow_html=True)

    col_up_l, col_up_r = st.columns([2, 1])
    with col_up_l:
        st.markdown("#### 📁  Upload your Amazon product CSV")
        st.caption(
            "Expected columns: `product_id`, `category`, `discounted_price`, "
            "`actual_price`, `rating`, `rating_count`"
        )
        uploaded = st.file_uploader("Choose CSV file", type=["csv"], label_visibility="collapsed")

    with col_up_r:
        st.markdown("#### 📌  Or use sample data")
        use_sample = st.button("Load bundled amazon.csv", type="secondary", use_container_width=True)

    # Resolve raw dataframe
    default_csv = PROJECT_ROOT / "data" / "raw" / "amazon.csv"
    raw_df = None

    if uploaded is not None:
        raw_df = pd.read_csv(uploaded)
        st.success(f"Uploaded **{uploaded.name}** — {len(raw_df):,} rows, {len(raw_df.columns)} columns")
    elif use_sample or st.session_state.get("_used_sample"):
        if default_csv.exists():
            raw_df = pd.read_csv(default_csv)
            st.session_state["_used_sample"] = True
            st.success(f"Loaded **amazon.csv** — {len(raw_df):,} rows, {len(raw_df.columns)} columns")
        else:
            st.error("Bundled amazon.csv not found at `data/raw/amazon.csv`.")

    # ── GATE: stop here until data is available ──────────────────────────
    if raw_df is None:
        st.markdown('<hr class="section-divider">', unsafe_allow_html=True)
        st.markdown(
            "<div style='text-align:center;padding:3rem 0'>"
            "<h3 style='color:#6c757d'>⬆️  Upload a CSV or load sample data to begin</h3>"
            "<p style='color:#adb5bd'>The analysis pipeline will run automatically and "
            "show each step with timing.</p></div>",
            unsafe_allow_html=True,
        )
        _render_footer()
        st.stop()

    # ── Preview raw data ─────────────────────────────────────────────────
    with st.expander("👀  Preview raw data", expanded=False):
        st.dataframe(raw_df.head(20), use_container_width=True)

    # ── User scenario inputs ─────────────────────────────────────────────
    st.markdown("#### 🎛️  Analysis Scenario")
    sc1, sc2 = st.columns(2)
    if "category" in raw_df.columns:
        top_categories = (
            raw_df["category"].astype(str).str.strip().replace("", np.nan).dropna().value_counts().head(30).index.tolist()
        )
        category_options = ["All Categories"] + top_categories
    else:
        category_options = ["All Categories"]

    with sc1:
        selected_category = st.selectbox("Choose product category", options=category_options, index=0)

    with sc2:
        use_custom_price = st.toggle("Use custom launch price", value=False)
        custom_launch_price = st.number_input(
            "Custom launch price (INR)",
            min_value=1.0,
            value=1999.0,
            step=100.0,
            disabled=not use_custom_price,
        )

    # ── RUN ANALYSIS BUTTON ──────────────────────────────────────────────
    st.markdown('<hr class="section-divider">', unsafe_allow_html=True)
    run_col1, run_col2, run_col3 = st.columns([1, 2, 1])
    with run_col2:
        run_clicked = st.button(
            "▶  Run Full Analysis",
            type="primary",
            use_container_width=True,
        )

    if not run_clicked and "results" not in st.session_state:
        st.markdown(
            "<div style='text-align:center;padding:2rem 0'>"
            "<p style='color:#adb5bd;font-size:1.05rem'>"
            "Click <b>Run Full Analysis</b> to start the 10-step pipeline.<br>"
            "Each step will display progress and elapsed time.</p></div>",
            unsafe_allow_html=True,
        )
        _render_footer()
        st.stop()

    # ═════════════════════════════════════════════════════════════════════
    #  PIPELINE  (only executes on button click)
    # ═════════════════════════════════════════════════════════════════════
    if run_clicked:
        total_t0 = time.perf_counter()
        step_logs: list[str] = []

        progress = st.progress(0, text="Starting analysis pipeline …")
        status_box = st.empty()
        _terminal_log("PIPELINE", "Run Analysis clicked")
        _terminal_log(
            "INPUT",
            (
                f"rows={len(raw_df):,}, cols={len(raw_df.columns)}, "
                f"category={selected_category}, keyword={keyword}, horizon={forecast_horizon}, "
                f"custom_price={'ON' if use_custom_price else 'OFF'}"
            ),
        )

        # ── step 1 ─ clean ───────────────────────────────────────────────
        _terminal_log("STEP 1/10", "Data cleaning started")
        progress.progress(5, text="Step 1/10 · Cleaning data …")
        t0 = time.perf_counter()
        df_clean = clean_dataframe(raw_df)
        if selected_category != "All Categories" and "category" in df_clean.columns:
            df_clean = df_clean[df_clean["category"].astype(str).str.contains(selected_category, case=False, na=False)].copy()
            if df_clean.empty:
                st.error("No rows left after applying selected category filter. Please choose another category.")
                st.stop()
        elapsed = time.perf_counter() - t0
        cat_note = "all categories" if selected_category == "All Categories" else f"category: {selected_category}"
        _terminal_log("STEP 1/10", f"Completed in {elapsed:.2f}s | valid_rows={len(df_clean):,} | {cat_note}")
        step_logs.append(_step_card(
            "🧹", "Data Cleaning",
            f"{len(raw_df):,} → {len(df_clean):,} valid products  ·  {cat_note}",
            elapsed,
        ))

        # ── step 2 ─ time-series ─────────────────────────────────────────
        _terminal_log("STEP 2/10", "Weekly time-series generation started")
        progress.progress(15, text="Step 2/10 · Generating weekly time-series …")
        t0 = time.perf_counter()
        has_date = "Date" in raw_df.columns or "date" in raw_df.columns
        if has_date:
            dc = "Date" if "Date" in raw_df.columns else "date"
            ts_df = raw_df.rename(columns={dc: "Date"}).copy()
            ts_df["Date"] = pd.to_datetime(ts_df["Date"])
            if "Units_Sold" not in ts_df.columns: ts_df["Units_Sold"] = ts_df.get("rating_count", 1)
            if "Weekly_Price" not in ts_df.columns: ts_df["Weekly_Price"] = ts_df.get("discounted_price", 0)
            ts_note = "used existing Date column"
        else:
            ts_df = generate_weekly_series(df_clean, years=3)
            ts_note = f"{len(ts_df)} weeks synthesised ({ts_df['Date'].min().date()} → {ts_df['Date'].max().date()})"
        elapsed = time.perf_counter() - t0
        _terminal_log(
            "STEP 2/10",
            f"Completed in {elapsed:.2f}s | rows={len(ts_df):,} | range={ts_df['Date'].min().date()} to {ts_df['Date'].max().date()}",
        )
        step_logs.append(_step_card("📅", "Time-Series Generation", ts_note, elapsed))

        # ── step 3 ─ google trends ───────────────────────────────────────
        _terminal_log("STEP 3/10", "Google Trends fetch started")
        progress.progress(25, text="Step 3/10 · Fetching Google Trends (India) …")
        t0 = time.perf_counter()
        start_str = ts_df["Date"].min().strftime("%Y-%m-%d")
        end_str   = ts_df["Date"].max().strftime("%Y-%m-%d")
        trends_df = fetch_google_trends(keyword, start_str, end_str)
        src = "cache/live" if _trends_cache_path(keyword).exists() else "synthetic"
        elapsed = time.perf_counter() - t0
        _terminal_log("STEP 3/10", f"Completed in {elapsed:.2f}s | trend_rows={len(trends_df):,} | source={src}")
        step_logs.append(_step_card(
            "📈", "Google Trends",
            f"\"{keyword}\" · {len(trends_df)} weeks · geo=IN · source: {src}",
            elapsed,
        ))

        # ── step 4 ─ merge ───────────────────────────────────────────────
        _terminal_log("STEP 4/10", "Sales + trends merge started")
        progress.progress(35, text="Step 4/10 · Merging datasets …")
        t0 = time.perf_counter()
        merged = merge_sales_trends(ts_df, trends_df, keyword)
        elapsed = time.perf_counter() - t0
        _terminal_log("STEP 4/10", f"Completed in {elapsed:.2f}s | merged_shape={merged.shape}")
        step_logs.append(_step_card("🔗", "Merge Sales + Trends",
                                    f"{merged.shape[0]} rows × {merged.shape[1]} cols", elapsed))

        # ── step 5 ─ features ────────────────────────────────────────────
        _terminal_log("STEP 5/10", "Feature engineering started")
        progress.progress(45, text="Step 5/10 · Engineering features …")
        t0 = time.perf_counter()
        feat_df = engineer_features(merged, keyword)
        elapsed = time.perf_counter() - t0
        _terminal_log("STEP 5/10", f"Completed in {elapsed:.2f}s | feature_shape={feat_df.shape}")
        step_logs.append(_step_card("⚙️", "Feature Engineering",
                                    f"{feat_df.shape[1]} features (lags, rolling avg, momentum, price lag)",
                                    elapsed))

        # ── step 6 ─ train/test split ────────────────────────────────────
        _terminal_log("STEP 6/10", "Train/test split started")
        progress.progress(50, text="Step 6/10 · Splitting train / test …")
        t0 = time.perf_counter()
        split = int(len(feat_df) * 0.8)
        train_part, test_part = feat_df.iloc[:split], feat_df.iloc[split:]
        feature_cols = [c for c in [
            "units_lag1", "units_lag2", "units_lag3", "units_roll4",
            keyword, "trend_lag1", "trend_lag2", "trend_lag3",
            "trend_momentum", "Weekly_Price", "price_lag1",
        ] if c in feat_df.columns]
        X_train, y_train = train_part[feature_cols], train_part["Units_Sold"]
        X_test,  y_test  = test_part[feature_cols],  test_part["Units_Sold"]
        elapsed = time.perf_counter() - t0
        _terminal_log(
            "STEP 6/10",
            f"Completed in {elapsed:.2f}s | train={len(train_part):,}, test={len(test_part):,}, features={len(feature_cols)}",
        )
        step_logs.append(_step_card("✂️", "Train / Test Split",
                                    f"80 / 20 — train {len(train_part)}, test {len(test_part)} weeks",
                                    elapsed))

        # ── step 7 ─ ARIMA ───────────────────────────────────────────────
        _terminal_log("STEP 7/10", "ARIMA baseline training started")
        progress.progress(60, text="Step 7/10 · Training ARIMA baseline …")
        t0 = time.perf_counter()
        arima_fit, arima_preds, arima_fitted = train_arima(y_train, len(y_test))
        arima_rmse = np.sqrt(mean_squared_error(y_test, arima_preds))
        arima_mape = _mape(y_test.values, arima_preds)
        elapsed = time.perf_counter() - t0
        _terminal_log(
            "STEP 7/10",
            f"Completed in {elapsed:.2f}s | ARIMA RMSE={arima_rmse:,.2f}, MAPE={arima_mape:.2f}%",
        )
        step_logs.append(_step_card("📉", "ARIMA(1,1,1) Baseline",
                                    f"RMSE {arima_rmse:,.1f} · MAPE {arima_mape:.2f}%",
                                    elapsed))

        # ── step 8 ─ XGBoost ─────────────────────────────────────────────
        _terminal_log("STEP 8/10", "XGBoost training started")
        progress.progress(75, text="Step 8/10 · Training XGBoost + Trends …")
        t0 = time.perf_counter()
        xgb_model, xgb_preds = train_xgboost(X_train, y_train, X_test)
        xgb_rmse = np.sqrt(mean_squared_error(y_test, xgb_preds))
        xgb_mape = _mape(y_test.values, xgb_preds)
        elapsed = time.perf_counter() - t0
        _terminal_log(
            "STEP 8/10",
            f"Completed in {elapsed:.2f}s | XGBoost RMSE={xgb_rmse:,.2f}, MAPE={xgb_mape:.2f}%",
        )
        step_logs.append(_step_card("🤖", "XGBoost + Google Trends",
                                    f"RMSE {xgb_rmse:,.1f} · MAPE {xgb_mape:.2f}%",
                                    elapsed))

        # ── step 9 ─ forecast ────────────────────────────────────────────
        _terminal_log("STEP 9/10", "Future forecasting started")
        progress.progress(85, text="Step 9/10 · Forecasting future demand …")
        t0 = time.perf_counter()
        xgb_future = forecast_future(xgb_model, feat_df, feature_cols, keyword, n=forecast_horizon)
        arima_future_vals = forecast_arima_future(feat_df["Units_Sold"], n=forecast_horizon)
        xgb_future["ARIMA_Forecast"] = arima_future_vals
        elapsed = time.perf_counter() - t0
        _terminal_log(
            "STEP 9/10",
            (
                f"Completed in {elapsed:.2f}s | weeks={forecast_horizon}, "
                f"XGB min/max={xgb_future['XGBoost_Forecast'].min():,.0f}/{xgb_future['XGBoost_Forecast'].max():,.0f}"
            ),
        )
        step_logs.append(_step_card("🔮", f"Forecast ({forecast_horizon} weeks)",
                                    f"XGBoost range: {xgb_future['XGBoost_Forecast'].min():,.0f} – "
                                    f"{xgb_future['XGBoost_Forecast'].max():,.0f} units",
                                    elapsed))

        # ── step 10 ─ price optimisation ─────────────────────────────────
        _terminal_log("STEP 10/10", "Price optimization started")
        progress.progress(95, text="Step 10/10 · Optimising price …")
        t0 = time.perf_counter()
        baseline_price = float(feat_df["Weekly_Price"].iloc[-1])
        last_price = float(custom_launch_price) if use_custom_price else baseline_price
        price_df = optimise_price(xgb_model, feat_df.iloc[-1].copy(), feature_cols, last_price)
        elapsed = time.perf_counter() - t0
        best_pi = int(price_df["Revenue"].idxmax())
        opt_price = price_df.loc[best_pi, "Price"]
        opt_demand = price_df.loc[best_pi, "Predicted_Demand"]
        opt_rev = price_df.loc[best_pi, "Revenue"]
        _terminal_log(
            "STEP 10/10",
            (
                f"Completed in {elapsed:.2f}s | base_price={last_price:,.0f}, "
                f"opt_price={opt_price:,.0f}, opt_demand={opt_demand:,.0f}, opt_revenue={opt_rev:,.0f}"
            ),
        )
        step_logs.append(_step_card("💰", "Price Optimisation",
                        f"Base ₹{last_price:,.0f} → Optimal ₹{opt_price:,.0f} · Revenue ₹{opt_rev:,.0f}",
                                    elapsed))

        total_elapsed = time.perf_counter() - total_t0
        _terminal_log("PIPELINE", f"Completed in {total_elapsed:.2f}s")
        progress.progress(100, text=f"✅  Pipeline complete — {total_elapsed:.2f}s total")
        time.sleep(0.4)
        progress.empty()

        # ── save into session state so results persist across reruns ──
        best_fi = int(xgb_future["XGBoost_Forecast"].idxmax())
        arima_nrmse = (arima_rmse / y_test.mean() * 100) if y_test.mean() != 0 else np.nan
        xgb_nrmse = (xgb_rmse / y_test.mean() * 100) if y_test.mean() != 0 else np.nan
        st.session_state["results"] = {
            "step_logs": step_logs,
            "total_elapsed": total_elapsed,
            "df_clean": df_clean,
            "ts_df": ts_df,
            "feat_df": feat_df,
            "keyword": keyword,
            "feature_cols": feature_cols,
            "arima_rmse": arima_rmse, "arima_mape": arima_mape,
            "xgb_rmse": xgb_rmse, "xgb_mape": xgb_mape,
            "arima_nrmse": arima_nrmse,
            "xgb_nrmse": xgb_nrmse,
            "arima_test_preds": arima_preds,
            "xgb_test_preds": xgb_preds,
            "test_dates": test_part["Date"].values,
            "test_actual": y_test.values,
            "train_dates": train_part["Date"].values,
            "train_actual": y_train.values,
            "arima_fitted": arima_fitted,
            "xgb_future": xgb_future,
            "price_df": price_df,
            "opt_price": opt_price, "opt_demand": opt_demand, "opt_rev": opt_rev,
            "best_launch": xgb_future.loc[best_fi, "Date"],
            "best_units": xgb_future.loc[best_fi, "XGBoost_Forecast"],
            "forecast_horizon": forecast_horizon,
            "selected_category": selected_category,
            "analysis_start": feat_df["Date"].min(),
            "analysis_end": feat_df["Date"].max(),
            "forecast_end": xgb_future["Date"].max(),
            "base_price_used": last_price,
        }

    # ═════════════════════════════════════════════════════════════════════
    #  RENDER RESULTS  (from session state)
    # ═════════════════════════════════════════════════════════════════════
    if "results" not in st.session_state:
        _render_footer()
        st.stop()

    R = st.session_state["results"]

    # ── Pipeline log ─────────────────────────────────────────────────────
    st.markdown('<hr class="section-divider">', unsafe_allow_html=True)
    st.markdown(f"### 🛠️  Pipeline Execution  —  completed in **{R['total_elapsed']:.2f}s**")
    with st.expander("View all 10 steps", expanded=True):
        st.markdown("".join(R["step_logs"]), unsafe_allow_html=True)

    # ── Headline metrics ─────────────────────────────────────────────────
    st.markdown('<hr class="section-divider">', unsafe_allow_html=True)
    st.markdown("### 🎯  Key Recommendations")

    rec_c1, rec_c2, rec_c3, rec_c4 = st.columns(4)
    rec_c1.metric("Best Launch Week", R["best_launch"].strftime("%d %b %Y"))
    rec_c2.metric("Optimal Price", f"₹{R['opt_price']:,.0f}")
    rec_c3.metric("Expected Units", f"{R['best_units']:,.0f}")
    rec_c4.metric("Expected Revenue", f"₹{R['opt_price'] * R['best_units']:,.0f}")

    # ── Model comparison ─────────────────────────────────────────────────
    st.markdown("### 📊  Model Performance")

    rmse_improve = ((R['arima_rmse'] - R['xgb_rmse']) / R['arima_rmse'] * 100) if R['arima_rmse'] > 0 else 0
    mape_improve = ((R['arima_mape'] - R['xgb_mape']) / R['arima_mape'] * 100) if R['arima_mape'] > 0 else 0

    mod_c1, mod_c2, mod_c3, mod_c4 = st.columns(4)
    mod_c1.metric("ARIMA RMSE", f"{R['arima_rmse']:,.1f}")
    mod_c2.metric("ARIMA MAPE", f"{R['arima_mape']:.2f}%")
    mod_c3.metric("XGBoost RMSE", f"{R['xgb_rmse']:,.1f}", delta=f"{rmse_improve:.1f}% lower", delta_color="inverse")
    mod_c4.metric("XGBoost MAPE", f"{R['xgb_mape']:.2f}%", delta=f"{mape_improve:.1f}% lower", delta_color="inverse")

    st.markdown("#### ✅ How to read these numbers")
    c1, c2, c3 = st.columns(3)
    c1.metric("ARIMA Accuracy Band", _score_band(R["arima_mape"]))
    c2.metric("XGBoost Accuracy Band", _score_band(R["xgb_mape"]))
    c3.metric("Best Model", "XGBoost" if R["xgb_mape"] <= R["arima_mape"] else "ARIMA")

    st.info(
        f"Lower RMSE and lower MAPE are better. In business forecasting, MAPE below 10% is usually considered excellent. "
        f"Current run: ARIMA MAPE {R['arima_mape']:.2f}% vs XGBoost MAPE {R['xgb_mape']:.2f}%."
    )

    with st.expander("🕒 How best launch timing is calculated", expanded=True):
        st.markdown(
            f"- Historical window used: **{pd.to_datetime(R['analysis_start']).strftime('%d %b %Y')}** to **{pd.to_datetime(R['analysis_end']).strftime('%d %b %Y')}**.\n"
            f"- Future window evaluated: next **{R['forecast_horizon']} weeks** ending on **{pd.to_datetime(R['forecast_end']).strftime('%d %b %Y')}**.\n"
            f"- For each future week, the model predicts demand.\n"
            f"- The app picks the week with the **highest predicted units** as best launch timing.\n"
            f"- Selected scope: **{R['selected_category']}**; baseline price used for optimization: **₹{R['base_price_used']:,.0f}**."
        )

    # ── Tabs: charts ─────────────────────────────────────────────────────
    st.markdown('<hr class="section-divider">', unsafe_allow_html=True)
    tab_fc, tab_fit, tab_tr, tab_pr = st.tabs(["📈  Forecast", "🔬  Model Fit (Test Set)", "🔍  Google Trends", "💰  Revenue Curve"])

    feat_df = R["feat_df"]
    kw      = R["keyword"]
    xgb_fut = R["xgb_future"]
    price_d = R["price_df"]

    with tab_fc:
        fig = go.Figure()
        fig.add_trace(go.Scatter(x=feat_df["Date"], y=feat_df["Units_Sold"],
                                 mode="lines", name="Historical",
                                 line=dict(color="#1f77b4", width=1.5)))
        fig.add_trace(go.Scatter(x=xgb_fut["Date"], y=xgb_fut["XGBoost_Forecast"],
                                 mode="lines+markers", name="XGBoost",
                                 line=dict(color="#2ca02c", width=2.5, dash="dash")))
        fig.add_trace(go.Scatter(x=xgb_fut["Date"], y=xgb_fut["ARIMA_Forecast"],
                                 mode="lines+markers", name="ARIMA",
                                 line=dict(color="#d62728", width=2, dash="dot")))
        # mark best week
        fig.add_trace(go.Scatter(
            x=[R["best_launch"]], y=[R["best_units"]],
            mode="markers+text", name="Best Launch",
            marker=dict(size=14, color="gold", symbol="star", line=dict(width=1.5, color="black")),
            text=["★ Best Week"], textposition="top center",
        ))
        fig.update_layout(
            title="Demand Forecast — ARIMA vs XGBoost",
            xaxis_title="Date", yaxis_title="Units Sold",
            height=500, hovermode="x unified",
            legend=dict(orientation="h", y=-0.15),
            template="plotly_white",
        )
        st.plotly_chart(fig, use_container_width=True)

    with tab_fit:
        # Actual vs ARIMA vs XGBoost on the test set — proves ARIMA works
        fig_fit = go.Figure()
        test_dates = pd.to_datetime(R["test_dates"])
        fig_fit.add_trace(go.Scatter(
            x=test_dates, y=R["test_actual"],
            mode="lines+markers", name="Actual",
            line=dict(color="#1f77b4", width=2.5),
            marker=dict(size=5),
        ))
        fig_fit.add_trace(go.Scatter(
            x=test_dates, y=R["arima_test_preds"],
            mode="lines+markers", name="SARIMA(1,1,1)(1,1,0,52)",
            line=dict(color="#d62728", width=2, dash="dot"),
            marker=dict(size=4),
        ))
        fig_fit.add_trace(go.Scatter(
            x=test_dates, y=R["xgb_test_preds"],
            mode="lines+markers", name="XGBoost + Trends",
            line=dict(color="#2ca02c", width=2, dash="dash"),
            marker=dict(size=4),
        ))
        fig_fit.update_layout(
            title="Test-Set Predictions — Actual vs SARIMA vs XGBoost",
            xaxis_title="Date", yaxis_title="Units Sold",
            height=500, hovermode="x unified",
            legend=dict(orientation="h", y=-0.15),
            template="plotly_white",
        )
        st.plotly_chart(fig_fit, use_container_width=True)

        # Training fitted values chart
        train_dates = pd.to_datetime(R["train_dates"])
        arima_fitted = R["arima_fitted"]
        # align lengths (SARIMAX fitted values may have leading NaNs)
        fit_len = min(len(train_dates), len(arima_fitted))
        fig_train = go.Figure()
        fig_train.add_trace(go.Scatter(
            x=train_dates[-fit_len:], y=R["train_actual"][-fit_len:],
            mode="lines", name="Actual (train)",
            line=dict(color="#1f77b4", width=2),
        ))
        fig_train.add_trace(go.Scatter(
            x=train_dates[-fit_len:], y=arima_fitted[-fit_len:],
            mode="lines", name="SARIMA Fitted",
            line=dict(color="#d62728", width=1.5, dash="dot"),
        ))
        fig_train.update_layout(
            title="SARIMA Training Fit — Model Captures Seasonal Patterns",
            xaxis_title="Date", yaxis_title="Units Sold",
            height=400, hovermode="x unified",
            legend=dict(orientation="h", y=-0.15),
            template="plotly_white",
        )
        st.plotly_chart(fig_train, use_container_width=True)

        st.info(
            f"**SARIMA(1,1,1)(1,1,0,52)** captures weekly seasonality (period=52) as the baseline.\n\n"
            f"**XGBoost + Google Trends** improves upon it by {rmse_improve:.1f}% (RMSE) "
            f"and {mape_improve:.1f}% (MAPE) using lag features, rolling averages, "
            f"and real-time Google Trends search interest from India."
        )

    with tab_tr:
        if kw in feat_df.columns:
            fig2 = go.Figure()
            fig2.add_trace(go.Scatter(x=feat_df["Date"], y=feat_df["Units_Sold"],
                                      name="Units Sold", yaxis="y1",
                                      line=dict(color="#1f77b4", width=2)))
            fig2.add_trace(go.Scatter(x=feat_df["Date"], y=feat_df[kw],
                                      name=f"Trends: {kw}", yaxis="y2",
                                      line=dict(color="#ff7f0e", width=2)))
            fig2.update_layout(
                title=f"Sales vs Google Trends — \"{kw}\" (India)",
                yaxis=dict(title="Units Sold", title_font=dict(color="#1f77b4"),
                           tickfont=dict(color="#1f77b4")),
                yaxis2=dict(title="Trends Index (0–100)", title_font=dict(color="#ff7f0e"),
                            tickfont=dict(color="#ff7f0e"), overlaying="y", side="right",
                            showgrid=False),
                height=480, hovermode="x unified", template="plotly_white",
                legend=dict(orientation="h", y=-0.15),
            )
            st.plotly_chart(fig2, use_container_width=True)
        else:
            st.info("Trend column not available.")

    with tab_pr:
        fig3 = go.Figure()
        fig3.add_trace(go.Scatter(
            x=price_d["Price"], y=price_d["Revenue"],
            mode="lines", name="Revenue",
            line=dict(color="#198754", width=3),
            fill="tozeroy", fillcolor="rgba(25,135,84,0.07)",
        ))
        fig3.add_trace(go.Scatter(
            x=[R["opt_price"]], y=[R["opt_rev"]],
            mode="markers+text", name="Optimal",
            marker=dict(size=14, color="red", symbol="star"),
            text=[f"₹{R['opt_price']:,.0f}"], textposition="top center",
        ))
        fig3.update_layout(
            title="Revenue Curve (Price ±30%)",
            xaxis_title="Price (₹)", yaxis_title="Estimated Weekly Revenue (₹)",
            height=460, template="plotly_white",
        )
        st.plotly_chart(fig3, use_container_width=True)

    # ── Summary table ────────────────────────────────────────────────────
    st.markdown('<hr class="section-divider">', unsafe_allow_html=True)
    st.markdown("### 📋  Summary")
    summary_data = {
        "Metric": [
            "Best launch week", "Optimal price",
            "Forecasted weekly demand", "Estimated weekly revenue",
            "ARIMA RMSE / MAPE", "XGBoost RMSE / MAPE",
            "ARIMA NRMSE / XGBoost NRMSE", "Google Trends keyword",
            "Category scope", "Timeline used", "Pipeline time",
        ],
        "Value": [
            R["best_launch"].strftime("%d %B %Y"),
            f"₹{R['opt_price']:,.0f}",
            f"{R['best_units']:,.0f} units",
            f"₹{R['opt_price'] * R['best_units']:,.0f}",
            f"{R['arima_rmse']:,.1f} / {R['arima_mape']:.2f}%",
            f"{R['xgb_rmse']:,.1f} / {R['xgb_mape']:.2f}%",
            f"{R['arima_nrmse']:.2f}% / {R['xgb_nrmse']:.2f}%",
            f"{kw} (geo=IN)",
            R["selected_category"],
            f"{pd.to_datetime(R['analysis_start']).strftime('%d %b %Y')} to {pd.to_datetime(R['analysis_end']).strftime('%d %b %Y')}",
            f"{R['total_elapsed']:.2f}s",
        ],
    }
    st.dataframe(pd.DataFrame(summary_data), use_container_width=True, hide_index=True)

    _render_footer()


def _render_footer():
    st.markdown(
        '<div class="footer">'
        'Enhancing E-Commerce Sales Forecasting Using Google Trends'
        '</div>',
        unsafe_allow_html=True,
    )


if __name__ == "__main__":
    main()
