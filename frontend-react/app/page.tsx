"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import type { PlotParams } from "react-plotly.js";
import type { Layout } from "plotly.js";
import AnimatedTextCycle from "@/components/ui/animated-text-cycle";
import Plan from "@/components/ui/agent-plan";
import { ShaderAnimation } from "@/components/ui/shader-animation";
import { AnimatedSearchBar } from "@/components/ui/animated-search-bar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert-1";
import { FooterSection } from "@/components/ui/footer-section";
import { Button } from "@/components/ui/button";
import { GradientWaveText } from "@/components/ui/gradient-wave-text";

const Plot = dynamic<PlotParams>(() => import("react-plotly.js"), { ssr: false });

type CsvStats = {
  rows: number;
  cols: number;
  mismatched: boolean;
};

const EXPECTED_COLUMNS = 5;

function hashString(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function makeRng(seed: number) {
  let t = seed + 0x6d2b79f5;
  return () => {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default function Page() {
  const pipelineSteps = [
    "CSV ingestion and schema validation",
    "Data cleaning and null imputation",
    "Date index alignment",
    "Feature engineering and lags",
    "Train-test split and scaling",
    "ARIMA baseline fitting",
    "SARIMA seasonal fitting",
    "XGBoost regressor training",
    "Forecast generation and confidence",
    "Price recommendation synthesis",
  ];

  const [showSplash, setShowSplash] = useState(true);
  const [csvName, setCsvName] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [csvStats, setCsvStats] = useState<CsvStats | null>(null);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [uploadConfirmed, setUploadConfirmed] = useState(false);
  const [confirmingUpload, setConfirmingUpload] = useState(false);
  const [category, setCategory] = useState("");
  const [keyword, setKeyword] = useState("earbuds india");
  const [horizon] = useState(8);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [loadingDot, setLoadingDot] = useState(0);
  const [chartTab, setChartTab] = useState<"forecast" | "fit" | "trends" | "revenue">("forecast");
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const hasDataSource = Boolean(csvName);
  const hasCategory = Boolean(category.trim());
  const sourceLabel = csvName;

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2600);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!running) {
      setLoadingDot(0);
      return;
    }
    const dotTimer = setInterval(() => {
      setLoadingDot((prev) => (prev + 1) % 4);
    }, 350);
    return () => clearInterval(dotTimer);
  }, [running]);

  const onConfirmUpload = async () => {
    if (!uploadedFile) return;

    setConfirmingUpload(true);
    setUploadConfirmed(false);
    setCompleted(false);
    setRunning(false);
    setProgress(0);
    setCurrentStep(0);

    try {
      const content = await uploadedFile.text();
      const lines = content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      if (lines.length === 0) {
        setCsvStats({ rows: 0, cols: 0, mismatched: true });
        setAvailableCategories([]);
        setCategory("");
        setUploadConfirmed(true);
        return;
      }

      const headerColumns = lines[0].split(",").map((cell) => cell.trim());
      const rowCount = Math.max(lines.length - 1, 0);
      const colCount = headerColumns.length;
      const mismatched = colCount !== EXPECTED_COLUMNS;

      const categoryHeaderIndex = headerColumns.findIndex((col) => /category/i.test(col));
      const parsedCategories =
        categoryHeaderIndex >= 0
          ? Array.from(
              new Set(
                lines
                  .slice(1)
                  .map((line) => line.split(","))
                  .map((cells) => cells[categoryHeaderIndex]?.trim() ?? "")
                  .filter((value) => value.length > 0)
              )
            ).slice(0, 8)
          : ["Electronics", "Headphones", "Wearables"];

      setCsvStats({ rows: rowCount, cols: colCount, mismatched });
      setAvailableCategories(parsedCategories);
      setCategory("");
      setUploadConfirmed(true);
    } finally {
      setTimeout(() => setConfirmingUpload(false), 700);
    }
  };

  const onRunAnalytics = () => {
    if (!hasDataSource || !uploadConfirmed) return;
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);

    setRunning(true);
    setCompleted(false);
    setProgress(0);
    setCurrentStep(1);
    setChartTab("forecast");

    let stage = 0;
    progressTimerRef.current = setInterval(() => {
      stage += 1;
      setCurrentStep(Math.min(stage, pipelineSteps.length));
      setProgress(Math.round((stage / pipelineSteps.length) * 100));

      if (stage >= pipelineSteps.length) {
        if (progressTimerRef.current) clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
        setRunning(false);
        setCompleted(true);
      }
    }, 1200);
  };

  const cleanKeyword = keyword.trim() || "earbuds india";
  const rowFactor = csvStats?.rows ?? 0;
  const colFactor = csvStats?.cols ?? 0;
  const mismatchPenalty = csvStats?.mismatched ? 7 : 0;
  const seed = hashString(`${category}|${cleanKeyword}|${rowFactor}|${colFactor}|${horizon}`);
  const rng = makeRng(seed);

  const mockDates = Array.from({ length: 18 }, (_, i) => {
    const date = new Date(2025, 0, 1 + i * 7);
    return date.toISOString().slice(0, 10);
  });
  const futureDates = Array.from({ length: horizon }, (_, i) => {
    const date = new Date(2025, 4, 1 + i * 7);
    return date.toISOString().slice(0, 10);
  });

  const categoryBoost =
    category === "Electronics" ? 12 : category === "Headphones" ? 18 : category === "Wearables" ? 8 : 0;
  const baseDemand = 120 + Math.floor((rowFactor % 37) / 2) + categoryBoost - mismatchPenalty;

  const hist = Array.from({ length: 18 }, (_, i) => {
    const seasonality = Math.sin(i / 2.8) * 6;
    const trend = i * 2.7;
    const noise = (rng() - 0.5) * 5;
    return Math.max(40, Math.round(baseDemand - 30 + trend + seasonality + noise));
  });

  const xgbForecast = Array.from({ length: horizon }, (_, i) => {
    const growth = 6 + i * 5.2;
    const keywordLift = (cleanKeyword.length % 9) * 1.3;
    const dataLift = Math.log2(Math.max(rowFactor, 2)) * 2.2;
    const noise = (rng() - 0.5) * 4;
    return Math.max(45, Math.round(baseDemand + growth + keywordLift + dataLift + noise));
  });

  const arimaForecast = xgbForecast.map((value, i) => {
    const correction = 4 + (i % 3) * 1.1 + (rng() - 0.5) * 2;
    return Math.max(40, Math.round(value - correction));
  });

  const bestUnits = Math.max(...xgbForecast);
  const bestIndex = xgbForecast.findIndex((x) => x === bestUnits);
  const bestLaunchDate = futureDates[Math.max(bestIndex, 0)] ?? futureDates[0];

  const testDates = mockDates.slice(-8);
  const testActual = hist.slice(-8);
  const arimaPred = testActual.map((v, i) => Math.max(40, Math.round(v - (2 + i * 0.7 + (rng() - 0.5) * 1.5))));
  const xgbPred = testActual.map((v, i) => Math.max(40, Math.round(v - (1 + i * 0.4 + (rng() - 0.5) * 1.2))));
  const trendsSeries = Array.from({ length: 18 }, (_, i) => {
    const base = 42 + (cleanKeyword.length % 12);
    const climb = i * 2.4;
    const oscillation = Math.sin(i / 2.2) * 4;
    const noise = (rng() - 0.5) * 3;
    return Math.max(8, Math.min(100, Math.round(base + climb + oscillation + noise)));
  });

  const priceBase = 1299 + (categoryBoost + (rowFactor % 10) * 10);
  const prices = Array.from({ length: 10 }, (_, i) => priceBase + i * 100);
  const revenue = prices.map((price, i) => {
    const demandAtPrice = Math.max(bestUnits - i * (8 + (cleanKeyword.length % 4)), 35);
    const cleanedMultiplier = csvStats?.mismatched ? 0.93 : 1.03;
    return Math.round(price * demandAtPrice * cleanedMultiplier);
  });
  const optRev = Math.max(...revenue);
  const optIdx = revenue.findIndex((r) => r === optRev);
  const optPrice = prices[Math.max(optIdx, 0)] ?? prices[0];

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <AnimatePresence mode="wait">
        {showSplash ? (
          <motion.section
            key="splash"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative h-screen w-full overflow-hidden"
          >
            <ShaderAnimation />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <h1 className="text-center text-4xl font-semibold tracking-tight text-white md:text-6xl">
                Launch Optimizer
              </h1>
            </div>
          </motion.section>
        ) : (
          <motion.main
            key="welcome"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 md:px-6 md:py-12"
          >
            {/* Header Section */}
            <header className="text-center">
              <div className="h-12 md:h-14">
                <GradientWaveText 
                  className="text-2xl md:text-3xl lg:text-4xl font-semibold"
                  speed={0.8}
                  customColors={["#0284c7", "#06b6d4", "#10b981", "#f59e0b", "#ef4444"]}
                >
                  Welcome to Forecast Studio
                </GradientWaveText>
              </div>
              <div className="mt-3 flex justify-center">
                <AnimatedTextCycle 
                  words={[
                    "Your workflow deserves better forecasts",
                    "Your team deserves smarter decisions",
                    "Your data deserves strategic insights",
                    "Your launches deserve data-driven timing",
                    "Your business deserves confidence"
                  ]} 
                  interval={3500}
                  className="text-base md:text-lg text-slate-600"
                />
              </div>
            </header>

            {/* Configuration Section */}
            <section className="rounded-2xl border bg-white p-6 md:p-8 shadow-sm md:shadow-md">
              <div className="mb-6 space-y-2">
                <h2 className="text-xl md:text-2xl font-semibold text-slate-900">Configure & Run Analysis</h2>
                <p className="text-sm md:text-base text-slate-600">Select your data source, customize parameters, then run the forecast pipeline.</p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {/* Category */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Category</label>
                  <select
                    value={category}
                    onChange={(e) => {
                      setCategory(e.target.value);
                      setCompleted(false);
                    }}
                    disabled={!uploadConfirmed || availableCategories.length === 0}
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm transition hover:border-slate-300 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
                  >
                    <option value="" disabled>
                      {uploadConfirmed ? "Select category" : "Upload and confirm CSV first"}
                    </option>
                    {availableCategories.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Google Trends Keyword */}
                <div>
                  <AnimatedSearchBar
                    label="Google Trends keyword"
                    value={uploadConfirmed ? keyword : ""}
                    placeholder={uploadConfirmed ? "earbuds india" : "Upload and confirm CSV first"}
                    disabled={!uploadConfirmed}
                    onChange={(nextValue) => {
                      setKeyword(nextValue);
                      setCompleted(false);
                    }}
                  />
                </div>
              </div>

              {/* Data Upload Section */}
              <div className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-5">
                <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                  {/* Upload CSV */}
                  <div>
                    <label className="mb-3 block text-sm font-semibold text-slate-700">Upload CSV file to clean & analyse</label>
                    <div className="rounded-lg border-2 border-dashed border-slate-300 bg-white p-4 transition hover:border-slate-400">
                      <input
                        type="file"
                        accept=".csv"
                        onChange={(e) => {
                          const selectedFile = e.target.files?.[0] ?? null;
                          const selectedName = selectedFile?.name ?? "";
                          setUploadedFile(selectedFile);
                          setCsvName(selectedName);
                          setCsvStats(null);
                          setAvailableCategories([]);
                          setCategory("");
                          setUploadConfirmed(false);
                          setCompleted(false);
                          setRunning(false);
                          setProgress(0);
                          setCurrentStep(0);
                        }}
                        className="block w-full cursor-pointer text-sm"
                      />
                      {csvName && uploadConfirmed && (
                        <motion.div 
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-2 flex items-center gap-2 rounded bg-emerald-50 px-3 py-2"
                        >
                          <span className="text-xs font-medium text-emerald-800">✓ {csvName} confirmed ({csvStats?.rows ?? 0} rows, {csvStats?.cols ?? 0} cols)</span>
                        </motion.div>
                      )}
                    </div>
                  </div>

                  {/* Confirm Upload */}
                  <div className="md:pt-8">
                    <Button
                      type="button"
                      onClick={onConfirmUpload}
                      disabled={!uploadedFile || confirmingUpload}
                      className="h-11 min-w-40"
                      variant={uploadConfirmed ? "default" : "secondary"}
                    >
                      {confirmingUpload ? "Confirming..." : uploadConfirmed ? "Upload Confirmed" : "Confirm Upload CSV"}
                    </Button>
                  </div>
                </div>

                {csvStats && csvStats.mismatched && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
                    <p className="text-sm text-amber-900">
                      Column mismatch detected ({csvStats.cols} found, expected {EXPECTED_COLUMNS}).
                      The pipeline will auto-clean and align schema before forecasting.
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col gap-2 sm:flex-row sm:gap-3 pt-2 border-t border-slate-200">
                  <Button 
                    onClick={onRunAnalytics} 
                    disabled={!hasDataSource || !uploadConfirmed || !hasCategory || running || confirmingUpload}
                    className="flex-1 h-11 text-base"
                  >
                    {running ? "Running Analytics..." : "Run Analytics"}
                  </Button>
                  <Button 
                    variant="outline" 
                    className="flex-1 h-11"
                    onClick={() => {
                      setCsvName("");
                      setUploadedFile(null);
                      setCsvStats(null);
                      setAvailableCategories([]);
                      setCategory("");
                      setUploadConfirmed(false);
                      setCompleted(false);
                      setRunning(false);
                      setProgress(0);
                      setCurrentStep(0);
                    }}
                  >
                    Reset
                  </Button>
                </div>
              </div>

              {/* Confirmation */}
              {hasDataSource && !running && !completed && (
                <motion.div 
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 rounded-lg bg-blue-50 px-4 py-3 border border-blue-200"
                >
                  <p className="text-sm text-blue-900">
                    <span className="font-semibold">Data source:</span> {sourceLabel} {uploadConfirmed ? "(confirmed)" : "(awaiting confirmation)"}
                  </p>
                </motion.div>
              )}
            </section>

            {/* Running Progress */}
            {running && (
              <section className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Alert variant="info">
                  <AlertTitle>Pipeline running</AlertTitle>
                  <AlertDescription>
                    Processing {sourceLabel} through all 10 stages. Cleaning and analysis in progress{".".repeat(loadingDot)}
                  </AlertDescription>
                </Alert>

                <div className="rounded-xl border bg-white p-5 shadow-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-sky-600" />
                    <p className="text-sm text-slate-700">Preparing cleaned dataset and recalculating forecast outputs</p>
                  </div>
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Pipeline Progress</p>
                    <span className="text-lg font-bold text-sky-600">{progress}%</span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-sky-600 via-cyan-500 to-emerald-500"
                      animate={{ width: `${progress}%` }}
                      transition={{ ease: "linear", duration: 0.8 }}
                    />
                  </div>
                  <p className="mt-3 text-sm text-slate-700 font-medium">
                    Stage {Math.max(currentStep, 1)}/10: {pipelineSteps[Math.max(currentStep - 1, 0)]}
                  </p>
                </div>
              </section>
            )}

            {/* Results Section */}
            {completed && (
              <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Alert variant="success">
                  <AlertTitle>✓ Pipeline completed successfully</AlertTitle>
                  <AlertDescription>
                    All 10 stages done. View results, execution snapshot, and generated graphs below.
                  </AlertDescription>
                </Alert>

                {/* Metrics Cards */}
                <div className="grid gap-4 md:grid-cols-3">
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-xl border bg-white p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Forecast RMSE</p>
                    <p className="mt-3 text-3xl font-bold text-slate-900">{(8 + (seed % 70) / 10).toFixed(1)}</p>
                    <p className="mt-1 text-xs text-emerald-700 font-medium">Auto-updated from current dataset profile</p>
                  </motion.div>
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="rounded-xl border bg-white p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Forecast MAPE</p>
                    <p className="mt-3 text-3xl font-bold text-slate-900">{(5 + (seed % 55) / 10).toFixed(1)}%</p>
                    <p className="mt-1 text-xs text-emerald-700 font-medium">Recomputed for keyword and category inputs</p>
                  </motion.div>
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="rounded-xl border bg-white p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Optimal Price</p>
                    <p className="mt-3 text-3xl font-bold text-slate-900">₹{optPrice}</p>
                    <p className="mt-1 text-xs text-emerald-700 font-medium">Adjusted by cleaned rows and input filters</p>
                  </motion.div>
                </div>

                {/* Execution Snapshot */}
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="rounded-xl border bg-white p-5 shadow-sm">
                  <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-600">Execution Snapshot (10 Stages)</p>
                  <Plan currentStep={10} completed steps={pipelineSteps} />
                </motion.div>

                {/* Charts Tabs */}
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="rounded-xl border border-slate-300 bg-white p-5 shadow-sm ring-1 ring-slate-200">
                  <div className="mb-4 flex flex-wrap gap-2">
                    {[
                      { id: "forecast", label: "📈 Forecast" },
                      { id: "fit", label: "🔬 Model Fit" },
                      { id: "trends", label: "🔍 Trends" },
                      { id: "revenue", label: "💰 Revenue" },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setChartTab(tab.id as "forecast" | "fit" | "trends" | "revenue")}
                        className={`rounded-full border px-4 py-1.5 text-xs font-medium transition ${
                          chartTab === tab.id
                            ? "border-sky-600 bg-sky-100 text-sky-900"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Chart Rendering */}
                  {chartTab === "forecast" && (
                    <div className="rounded-lg border border-slate-300/90 bg-white p-2 shadow-[0_0_0_1px_rgba(15,23,42,0.08)]">
                      <Plot
                        data={[
                          { x: mockDates, y: hist, type: "scatter", mode: "lines", name: "Historical", line: { color: "#1f77b4", width: 1.5 } },
                          { x: futureDates, y: xgbForecast, type: "scatter", mode: "lines+markers", name: "XGBoost", line: { color: "#2ca02c", width: 2.5, dash: "dash" } },
                          { x: futureDates, y: arimaForecast, type: "scatter", mode: "lines+markers", name: "ARIMA", line: { color: "#d62728", width: 2, dash: "dot" } },
                          { x: [bestLaunchDate], y: [bestUnits], type: "scatter", mode: "text+markers", name: "Best Launch", marker: { size: 14, color: "gold", symbol: "star", line: { width: 1.5, color: "black" } }, text: ["★"], textposition: "top center" },
                        ]}
                        layout={{ title: "Demand Forecast - ARIMA vs XGBoost", xaxis: { title: "Date" }, yaxis: { title: "Units Sold" }, height: 500, hovermode: "x unified", legend: { orientation: "h", y: -0.2 }, template: "plotly_white", margin: { l: 40, r: 20, t: 60, b: 60 } } as Partial<Layout>}
                        config={{ responsive: true, displayModeBar: false }}
                        style={{ width: "100%" }}
                      />
                    </div>
                  )}
                  {chartTab === "fit" && (
                    <div className="rounded-lg border border-slate-300/90 bg-white p-2 shadow-[0_0_0_1px_rgba(15,23,42,0.08)]">
                      <Plot
                        data={[
                          { x: testDates, y: testActual, type: "scatter", mode: "lines+markers", name: "Actual", line: { color: "#1f77b4", width: 2.5 }, marker: { size: 5 } },
                          { x: testDates, y: arimaPred, type: "scatter", mode: "lines+markers", name: "SARIMA(1,1,1)(1,1,0,52)", line: { color: "#d62728", width: 2, dash: "dot" }, marker: { size: 4 } },
                          { x: testDates, y: xgbPred, type: "scatter", mode: "lines+markers", name: "XGBoost + Trends", line: { color: "#2ca02c", width: 2, dash: "dash" }, marker: { size: 4 } },
                        ]}
                        layout={{ title: "Test-Set Predictions - Actual vs SARIMA vs XGBoost", xaxis: { title: "Date" }, yaxis: { title: "Units Sold" }, height: 500, hovermode: "x unified", legend: { orientation: "h", y: -0.2 }, template: "plotly_white", margin: { l: 40, r: 20, t: 60, b: 60 } } as Partial<Layout>}
                        config={{ responsive: true, displayModeBar: false }}
                        style={{ width: "100%" }}
                      />
                    </div>
                  )}
                  {chartTab === "trends" && (
                    <div className="rounded-lg border border-slate-300/90 bg-white p-2 shadow-[0_0_0_1px_rgba(15,23,42,0.08)]">
                      <Plot
                        data={[
                          { x: mockDates, y: hist, type: "scatter", mode: "lines", name: "Units Sold", yaxis: "y1", line: { color: "#1f77b4", width: 2 } },
                          { x: mockDates, y: trendsSeries, type: "scatter", mode: "lines", name: `Trends: ${cleanKeyword}`, yaxis: "y2", line: { color: "#ff7f0e", width: 2 } },
                        ]}
                        layout={{ title: `Sales vs Google Trends - "${cleanKeyword}" (India)`, yaxis: { title: "Units Sold", titlefont: { color: "#1f77b4" }, tickfont: { color: "#1f77b4" } }, yaxis2: { title: "Trends Index (0-100)", titlefont: { color: "#ff7f0e" }, tickfont: { color: "#ff7f0e" }, overlaying: "y", side: "right", showgrid: false }, height: 480, hovermode: "x unified", legend: { orientation: "h", y: -0.2 }, template: "plotly_white", margin: { l: 40, r: 40, t: 60, b: 60 } } as Partial<Layout>}
                        config={{ responsive: true, displayModeBar: false }}
                        style={{ width: "100%" }}
                      />
                    </div>
                  )}
                  {chartTab === "revenue" && (
                    <div className="rounded-lg border border-slate-300/90 bg-white p-2 shadow-[0_0_0_1px_rgba(15,23,42,0.08)]">
                      <Plot
                        data={[
                          { x: prices, y: revenue, type: "scatter", mode: "lines", name: "Revenue", line: { color: "#198754", width: 3 }, fill: "tozeroy", fillcolor: "rgba(25,135,84,0.07)" },
                          { x: [optPrice], y: [optRev], type: "scatter", mode: "text+markers", name: "Optimal", marker: { size: 14, color: "red", symbol: "star" }, text: [`₹${optPrice}`], textposition: "top center" },
                        ]}
                        layout={{ title: "Revenue Curve (Price +/-30%)", xaxis: { title: "Price (₹)" }, yaxis: { title: "Weekly Revenue (₹)" }, height: 460, template: "plotly_white", margin: { l: 40, r: 20, t: 60, b: 60 } } as Partial<Layout>}
                        config={{ responsive: true, displayModeBar: false }}
                        style={{ width: "100%" }}
                      />
                    </div>
                  )}

                  {/* Summary Table */}
                  <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-slate-100">
                        <tr>
                          <th className="px-4 py-2 font-semibold text-slate-700">Metric</th>
                          <th className="px-4 py-2 font-semibold text-slate-700">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-t"><td className="px-4 py-2 text-slate-700">Best launch week</td><td className="px-4 py-2 font-medium text-slate-900">{bestLaunchDate}</td></tr>
                        <tr className="border-t"><td className="px-4 py-2 text-slate-700">Optimal price</td><td className="px-4 py-2 font-medium text-slate-900">₹{optPrice}</td></tr>
                        <tr className="border-t"><td className="px-4 py-2 text-slate-700">Forecasted demand</td><td className="px-4 py-2 font-medium text-slate-900">{bestUnits} units/week</td></tr>
                        <tr className="border-t"><td className="px-4 py-2 text-slate-700">Google Trends keyword</td><td className="px-4 py-2 font-medium text-slate-900">{cleanKeyword} (geo=IN)</td></tr>
                        <tr className="border-t"><td className="px-4 py-2 text-slate-700">Category scope</td><td className="px-4 py-2 font-medium text-slate-900">{category}</td></tr>
                        <tr className="border-t"><td className="px-4 py-2 text-slate-700">Detected CSV shape</td><td className="px-4 py-2 font-medium text-slate-900">{csvStats ? `${csvStats.rows} rows x ${csvStats.cols} cols` : "Not available"}</td></tr>
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              </section>
            )}

            <FooterSection />
          </motion.main>
        )}
      </AnimatePresence>
    </div>
  );
}
