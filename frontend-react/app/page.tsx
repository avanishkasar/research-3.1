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
  const [selectedDataset, setSelectedDataset] = useState("");
  const [category, setCategory] = useState("All Categories");
  const [keyword, setKeyword] = useState("earbuds india");
  const [horizon, setHorizon] = useState(8);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [chartTab, setChartTab] = useState<"forecast" | "fit" | "trends" | "revenue">("forecast");
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const hasDataSource = Boolean(csvName || selectedDataset);
  const sourceLabel = csvName || selectedDataset;

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2600);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, []);

  const onRunAnalytics = () => {
    if (!hasDataSource) return;
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
    }, 1000);
  };

  const mockDates = Array.from({ length: 18 }, (_, i) => {
    const date = new Date(2025, 0, 1 + i * 7);
    return date.toISOString().slice(0, 10);
  });
  const futureDates = Array.from({ length: horizon }, (_, i) => {
    const date = new Date(2025, 4, 1 + i * 7);
    return date.toISOString().slice(0, 10);
  });

  const hist = [95, 102, 98, 104, 107, 115, 112, 118, 122, 126, 124, 132, 138, 136, 142, 149, 154, 160];
  const xgbForecast = Array.from({ length: horizon }, (_, i) => 165 + i * 6 + (i % 2 === 0 ? 4 : -2));
  const arimaForecast = Array.from({ length: horizon }, (_, i) => 162 + i * 5 + (i % 3 === 0 ? 3 : -1));
  const bestUnits = Math.max(...xgbForecast);
  const bestIndex = xgbForecast.findIndex((x) => x === bestUnits);
  const bestLaunchDate = futureDates[Math.max(bestIndex, 0)] ?? futureDates[0];

  const testDates = mockDates.slice(-8);
  const testActual = [126, 124, 132, 138, 136, 142, 149, 154];
  const arimaPred = [124, 123, 129, 133, 132, 137, 143, 148];
  const xgbPred = [127, 125, 131, 137, 135, 141, 148, 153];
  const trendsSeries = [46, 49, 48, 52, 57, 61, 60, 66, 69, 72, 70, 74, 79, 78, 83, 88, 91, 95];

  const prices = [1299, 1399, 1499, 1599, 1699, 1799, 1899, 1999, 2099, 2199];
  const revenue = [178000, 196000, 214000, 236000, 252000, 266000, 261000, 248000, 226000, 205000];
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

              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {/* Category */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm transition hover:border-slate-300 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
                  >
                    <option>All Categories</option>
                    <option>Electronics</option>
                    <option>Headphones</option>
                    <option>Wearables</option>
                  </select>
                </div>

                {/* Google Trends Keyword */}
                <div>
                  <AnimatedSearchBar
                    label="Google Trends keyword"
                    value={keyword}
                    placeholder="Type keyword..."
                    onChange={setKeyword}
                  />
                </div>

                {/* Forecast Horizon */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Forecast horizon: <span className="text-sky-600 font-bold">{horizon}w</span>
                  </label>
                  <input
                    type="range"
                    min={4}
                    max={12}
                    value={horizon}
                    onChange={(e) => setHorizon(Number(e.target.value))}
                    className="w-full h-2 rounded-lg bg-slate-200 accent-sky-600"
                  />
                  <div className="mt-1 flex justify-between text-xs text-slate-500">
                    <span>4w</span>
                    <span>12w</span>
                  </div>
                </div>
              </div>

              {/* Data Upload Section */}
              <div className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-5">
                <div className="grid gap-4 md:grid-cols-2">
                  {/* Upload CSV */}
                  <div>
                    <label className="mb-3 block text-sm font-semibold text-slate-700">Upload CSV file to clean & analyse</label>
                    <div className="rounded-lg border-2 border-dashed border-slate-300 bg-white p-4 transition hover:border-slate-400">
                      <input
                        type="file"
                        accept=".csv"
                        onChange={(e) => {
                          const selectedFile = e.target.files?.[0]?.name ?? "";
                          setCsvName(selectedFile);
                          if (selectedFile) setSelectedDataset("");
                          setCompleted(false);
                          setRunning(false);
                          setProgress(0);
                          setCurrentStep(0);
                        }}
                        className="block w-full cursor-pointer text-sm"
                      />
                      {csvName && (
                        <motion.div 
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-2 flex items-center gap-2 rounded bg-emerald-50 px-3 py-2"
                        >
                          <span className="text-xs font-medium text-emerald-800">✓ {csvName}</span>
                        </motion.div>
                      )}
                    </div>
                  </div>

                  {/* Preloaded Data */}
                  <div>
                    <label className="mb-3 block text-sm font-semibold text-slate-700">Or use sample data</label>
                    <Button
                      type="button"
                      onClick={() => {
                        setSelectedDataset("Amazon Earbuds Sample");
                        setCsvName("");
                        setCompleted(false);
                        setRunning(false);
                        setProgress(0);
                        setCurrentStep(0);
                      }}
                      variant={selectedDataset ? "default" : "secondary"}
                      className="w-full h-11"
                    >
                      {selectedDataset ? `✓ ${selectedDataset}` : "Load Sample Data"}
                    </Button>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-2 sm:flex-row sm:gap-3 pt-2 border-t border-slate-200">
                  <Button 
                    onClick={onRunAnalytics} 
                    disabled={!hasDataSource || running}
                    className="flex-1 h-11 text-base"
                  >
                    {running ? "Running Analytics..." : "Run Analytics"}
                  </Button>
                  <Button 
                    variant="outline" 
                    className="flex-1 h-11"
                    onClick={() => {
                      setCsvName("");
                      setSelectedDataset("");
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
                  <p className="text-sm text-blue-900"><span className="font-semibold">Data source:</span> {sourceLabel}</p>
                </motion.div>
              )}
            </section>

            {/* Running Progress */}
            {running && (
              <section className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Alert variant="info">
                  <AlertTitle>Pipeline running</AlertTitle>
                  <AlertDescription>
                    Processing {sourceLabel} through all 10 stages. Estimated time: 10 seconds.
                  </AlertDescription>
                </Alert>

                <div className="rounded-xl border bg-white p-5 shadow-sm">
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
                    <p className="mt-3 text-3xl font-bold text-slate-900">12.8</p>
                    <p className="mt-1 text-xs text-emerald-700 font-medium">9.2% better than baseline</p>
                  </motion.div>
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="rounded-xl border bg-white p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Forecast MAPE</p>
                    <p className="mt-3 text-3xl font-bold text-slate-900">8.6%</p>
                    <p className="mt-1 text-xs text-emerald-700 font-medium">Within deployment threshold</p>
                  </motion.div>
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="rounded-xl border bg-white p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Optimal Price</p>
                    <p className="mt-3 text-3xl font-bold text-slate-900">₹1,799</p>
                    <p className="mt-1 text-xs text-emerald-700 font-medium">+14.3% revenue expected</p>
                  </motion.div>
                </div>

                {/* Execution Snapshot */}
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="rounded-xl border bg-white p-5 shadow-sm">
                  <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-600">Execution Snapshot (10 Stages)</p>
                  <Plan currentStep={10} completed steps={pipelineSteps} />
                </motion.div>

                {/* Charts Tabs */}
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="rounded-xl border bg-white p-5 shadow-sm">
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
                    <Plot
                      data={[
                        { x: mockDates, y: hist, type: "scatter", mode: "lines", name: "Historical", line: { color: "#1f77b4", width: 1.5 } },
                        { x: futureDates, y: xgbForecast, type: "scatter", mode: "lines+markers", name: "XGBoost", line: { color: "#2ca02c", width: 2.5, dash: "dash" } },
                        { x: futureDates, y: arimaForecast, type: "scatter", mode: "lines+markers", name: "ARIMA", line: { color: "#d62728", width: 2, dash: "dot" } },
                        { x: [bestLaunchDate], y: [bestUnits], type: "scatter", mode: "text+markers", name: "Best Launch", marker: { size: 14, color: "gold", symbol: "star", line: { width: 1.5, color: "black" } }, text: ["★"], textposition: "top center" },
                      ]}
                      layout={{ title: "Demand Forecast — ARIMA vs XGBoost", xaxis: { title: "Date" }, yaxis: { title: "Units Sold" }, height: 500, hovermode: "x unified", legend: { orientation: "h", y: -0.2 }, template: "plotly_white", margin: { l: 40, r: 20, t: 60, b: 60 } } as Partial<Layout>}
                      config={{ responsive: true, displayModeBar: false }}
                      style={{ width: "100%" }}
                    />
                  )}
                  {chartTab === "fit" && (
                    <Plot
                      data={[
                        { x: testDates, y: testActual, type: "scatter", mode: "lines+markers", name: "Actual", line: { color: "#1f77b4", width: 2.5 }, marker: { size: 5 } },
                        { x: testDates, y: arimaPred, type: "scatter", mode: "lines+markers", name: "SARIMA(1,1,1)(1,1,0,52)", line: { color: "#d62728", width: 2, dash: "dot" }, marker: { size: 4 } },
                        { x: testDates, y: xgbPred, type: "scatter", mode: "lines+markers", name: "XGBoost + Trends", line: { color: "#2ca02c", width: 2, dash: "dash" }, marker: { size: 4 } },
                      ]}
                      layout={{ title: "Test-Set Predictions — Actual vs SARIMA vs XGBoost", xaxis: { title: "Date" }, yaxis: { title: "Units Sold" }, height: 500, hovermode: "x unified", legend: { orientation: "h", y: -0.2 }, template: "plotly_white", margin: { l: 40, r: 20, t: 60, b: 60 } } as Partial<Layout>}
                      config={{ responsive: true, displayModeBar: false }}
                      style={{ width: "100%" }}
                    />
                  )}
                  {chartTab === "trends" && (
                    <Plot
                      data={[
                        { x: mockDates, y: hist, type: "scatter", mode: "lines", name: "Units Sold", yaxis: "y1", line: { color: "#1f77b4", width: 2 } },
                        { x: mockDates, y: trendsSeries, type: "scatter", mode: "lines", name: `Trends: ${keyword}`, yaxis: "y2", line: { color: "#ff7f0e", width: 2 } },
                      ]}
                      layout={{ title: `Sales vs Google Trends — "${keyword}" (India)`, yaxis: { title: "Units Sold", titlefont: { color: "#1f77b4" }, tickfont: { color: "#1f77b4" } }, yaxis2: { title: "Trends Index (0-100)", titlefont: { color: "#ff7f0e" }, tickfont: { color: "#ff7f0e" }, overlaying: "y", side: "right", showgrid: false }, height: 480, hovermode: "x unified", legend: { orientation: "h", y: -0.2 }, template: "plotly_white", margin: { l: 40, r: 40, t: 60, b: 60 } } as Partial<Layout>}
                      config={{ responsive: true, displayModeBar: false }}
                      style={{ width: "100%" }}
                    />
                  )}
                  {chartTab === "revenue" && (
                    <Plot
                      data={[
                        { x: prices, y: revenue, type: "scatter", mode: "lines", name: "Revenue", line: { color: "#198754", width: 3 }, fill: "tozeroy", fillcolor: "rgba(25,135,84,0.07)" },
                        { x: [optPrice], y: [optRev], type: "scatter", mode: "text+markers", name: "Optimal", marker: { size: 14, color: "red", symbol: "star" }, text: [`₹${optPrice}`], textposition: "top center" },
                      ]}
                      layout={{ title: "Revenue Curve (Price +/-30%)", xaxis: { title: "Price (₹)" }, yaxis: { title: "Weekly Revenue (₹)" }, height: 460, template: "plotly_white", margin: { l: 40, r: 20, t: 60, b: 60 } } as Partial<Layout>}
                      config={{ responsive: true, displayModeBar: false }}
                      style={{ width: "100%" }}
                    />
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
                        <tr className="border-t"><td className="px-4 py-2 text-slate-700">Google Trends keyword</td><td className="px-4 py-2 font-medium text-slate-900">{keyword} (geo=IN)</td></tr>
                        <tr className="border-t"><td className="px-4 py-2 text-slate-700">Category scope</td><td className="px-4 py-2 font-medium text-slate-900">{category}</td></tr>
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
