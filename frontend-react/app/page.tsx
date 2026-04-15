"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

type CsvRecord = Record<string, string>;

const MIN_SERIES_POINTS = 18;

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function toNumber(value: string) {
  const normalized = value.replace(/[^0-9.-]/g, "").trim();
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenize(value: string) {
  return normalizeText(value).split(" ").filter((t) => t.length > 2);
}

function tokenizeFlexible(value: string) {
  return value
    .replace(/[|&_/-]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((token) => token.length > 2)
    .flatMap((token) => {
      const variants = new Set<string>([token]);
      if (token.endsWith("ies") && token.length > 4) variants.add(`${token.slice(0, -3)}y`);
      if (token.endsWith("es") && token.length > 4) variants.add(token.slice(0, -2));
      if (token.endsWith("s") && token.length > 3) variants.add(token.slice(0, -1));
      return Array.from(variants);
    });
}

function toDateOrNull(value: string) {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

const CATEGORY_KEYWORD_EXAMPLES: Record<string, string[]> = {
  electronics: ["earbuds india", "bluetooth speaker india", "smart tv india"],
  wearables: ["smartwatch india", "fitness band india", "heart rate watch india"],
  clothing: ["cotton tshirt india", "running shoes india", "winter jacket india"],
  books: ["bestseller books india", "fiction books india", "study guide india"],
  beauty: ["lipstick india", "skin care india", "hair dryer india"],
  "home kitchen": ["air fryer india", "kitchen organizer india", "nonstick pan india"],
};

const KEYWORD_STOPWORDS = new Set([
  "with",
  "for",
  "and",
  "the",
  "pack",
  "meter",
  "inch",
  "black",
  "white",
  "grey",
  "type",
  "cable",
  "usb",
  "fast",
  "charging",
  "data",
]);

function getKeywordExamplesForCategory(category: string, rows: CsvRecord[], categoryColumn: string) {
  if (!category) return [] as string[];

  const normCategory = normalizeText(category);
  const aliasTokens = normCategory.split(" ").filter(Boolean);
  const builtIn = CATEGORY_KEYWORD_EXAMPLES[aliasTokens.join(" ")] ??
    aliasTokens.flatMap((token) => CATEGORY_KEYWORD_EXAMPLES[token] ?? []);

  const candidateProductCols = ["product_name", "product", "name", "about_product", "title"];
  const productCol = candidateProductCols.find((col) => rows.length > 0 && col in rows[0]);

  const dataDrivenExamples: string[] = [];
  if (productCol && categoryColumn) {
    const tokenCounts = new Map<string, number>();
    rows
      .filter((row) => normalizeText(row[categoryColumn] ?? "") === normCategory)
      .slice(0, 300)
      .forEach((row) => {
        tokenize(row[productCol] ?? "").forEach((token) => {
          if (token.length < 4 || KEYWORD_STOPWORDS.has(token)) return;
          tokenCounts.set(token, (tokenCounts.get(token) ?? 0) + 1);
        });
      });

    const topTokens = Array.from(tokenCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([token]) => `${token} india`);

    dataDrivenExamples.push(...topTokens);
  }

  return Array.from(new Set([...dataDrivenExamples, ...builtIn])).slice(0, 4);
}

function isKeywordAlignedWithCategory(category: string, keyword: string, keywordExamples: string[] = []) {
  const categoryTokens = tokenizeFlexible(category);
  const keywordTokens = tokenizeFlexible(keyword);
  const exampleTokens = keywordExamples.flatMap((example) => tokenizeFlexible(example));

  if (keywordTokens.length === 0) return false;
  if (categoryTokens.length === 0) return true;

  const aliasMap: Record<string, string[]> = {
    electronics: ["earbuds", "headphones", "audio", "gadgets", "bluetooth"],
    wearables: ["watch", "watches", "band", "fitness", "smartwatch"],
    headphones: ["earbuds", "headphones", "audio", "noise", "anc"],
    computer: ["adapter", "wifi", "wireless", "network", "router", "usb"],
    accessory: ["adapter", "cable", "wireless", "usb", "network"],
    networking: ["adapter", "wifi", "wireless", "network", "router"],
    network: ["adapter", "wifi", "wireless", "router", "ethernet"],
    adapter: ["adapter", "wireless", "wifi", "usb"],
  };

  const mapped = categoryTokens.flatMap((token) => aliasMap[token] ?? []);
  const acceptedTokens = new Set([...categoryTokens, ...mapped, ...exampleTokens]);

  return keywordTokens.some((token) => {
    if (acceptedTokens.has(token)) return true;
    if (token.length < 4) return false;
    return Array.from(acceptedTokens).some((accepted) => accepted.includes(token) || token.includes(accepted));
  });
}

function percentile(values: number[], p: number) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = clamp(Math.round((sorted.length - 1) * p), 0, sorted.length - 1);
  return sorted[idx] ?? null;
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
  const [demoCsvContent, setDemoCsvContent] = useState("");
  const [csvStats, setCsvStats] = useState<CsvStats | null>(null);
  const [csvRecords, setCsvRecords] = useState<CsvRecord[]>([]);
  const [categoryColumn, setCategoryColumn] = useState("");
  const [dateColumn, setDateColumn] = useState("");
  const [valueColumn, setValueColumn] = useState("");
  const [priceColumn, setPriceColumn] = useState("");
  const [previewColumn, setPreviewColumn] = useState("");
  const [validationMessage, setValidationMessage] = useState("");
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
  const progressSectionRef = useRef<HTMLElement | null>(null);

  const hasDataSource = Boolean(csvName);
  const hasCategory = Boolean(category.trim());
  const hasValidCsv = uploadConfirmed && !validationMessage;
  const keywordExamples = useMemo(
    () => getKeywordExamplesForCategory(category, csvRecords, categoryColumn),
    [category, csvRecords, categoryColumn]
  );
  const keywordAligned = isKeywordAlignedWithCategory(category, keyword, keywordExamples);
  const keywordCategoryMessage = hasCategory && !keywordAligned
    ? `Keyword should match selected category context. ${keywordExamples.length > 0 ? `Try: ${keywordExamples.join(", ")}` : "Try a product term from the selected category."}`
    : "";
  const sourceLabel = csvName;
  const csvHeaders = useMemo(() => (csvRecords.length > 0 ? Object.keys(csvRecords[0]) : []), [csvRecords]);
  const previewRows = useMemo(
    () => (previewColumn ? csvRecords.slice(0, 6).map((row) => row[previewColumn] ?? "") : []),
    [csvRecords, previewColumn]
  );

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

  useEffect(() => {
    if (!running || !progressSectionRef.current) return;

    requestAnimationFrame(() => {
      progressSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, [running]);

  const onConfirmUpload = async () => {
    if (!uploadedFile && !demoCsvContent) return;

    setConfirmingUpload(true);
    setUploadConfirmed(false);
    setCompleted(false);
    setRunning(false);
    setProgress(0);
    setCurrentStep(0);
    setValidationMessage("");

    try {
      const content = uploadedFile ? await uploadedFile.text() : demoCsvContent;
      const lines = content
        .split(/\r?\n/)
        .map((line) => line.replace(/\uFEFF/g, "").trim())
        .filter((line) => line.length > 0);

      if (lines.length === 0) {
        setCsvStats({ rows: 0, cols: 0, mismatched: true });
        setCsvRecords([]);
        setCategoryColumn("");
        setDateColumn("");
        setValueColumn("");
        setPriceColumn("");
        setPreviewColumn("");
        setAvailableCategories([]);
        setCategory("");
        setValidationMessage("CSV file is empty.");
        setUploadConfirmed(true);
        return;
      }

      const headerColumns = parseCsvLine(lines[0]).map((cell) => cell.trim());
      const rowCount = Math.max(lines.length - 1, 0);
      const colCount = headerColumns.length;
      const rawRows = lines.slice(1).map((line) => parseCsvLine(line));
      const mismatched = rawRows.some((cells) => cells.length !== colCount);

      const normalizedRows = rawRows.map((cells) => {
        if (cells.length >= colCount) return cells.slice(0, colCount);
        return [...cells, ...Array.from({ length: colCount - cells.length }, () => "")];
      });

      const records: CsvRecord[] = normalizedRows.map((cells) => {
        const record: CsvRecord = {};
        headerColumns.forEach((header, idx) => {
          record[header] = cells[idx] ?? "";
        });
        return record;
      });

      const categoryHeader = headerColumns.find((col) => /category/i.test(col)) ?? "";
      const parsedCategories = categoryHeader
        ? Array.from(
            new Set(
              records
                .map((row) => row[categoryHeader]?.trim() ?? "")
                .filter((value) => value.length > 0)
            )
          )
        : [];

      const numericColumns = headerColumns.filter((header) => {
        const numericCount = records.reduce((count, row) => (toNumber(row[header] ?? "") !== null ? count + 1 : count), 0);
        return records.length > 0 && numericCount / records.length >= 0.7;
      });

      const preferredValueColumn =
        numericColumns.find((col) => /(sales|units|demand|qty|quantity|volume|orders|revenue)/i.test(col)) ??
        numericColumns.find((col) => /(rating_count|review_count|reviews|count|purchases|sold)/i.test(col)) ??
        numericColumns.find((col) => !/(price|rating|discount|mrp|amount|cost)/i.test(col)) ??
        numericColumns[0] ??
        "";

      const preferredPriceColumn =
        numericColumns.find((col) => /(discounted_price|actual_price|price|mrp|amount|cost)/i.test(col)) ??
        "";

      const preferredDateColumn =
        headerColumns.find((col) => /(date|time|week|month|day)/i.test(col)) ?? "";

      const eligibleCategories = categoryHeader && preferredValueColumn
        ? parsedCategories.filter((cat) => {
            const count = records.reduce((acc, row) => {
              const catValue = (row[categoryHeader] ?? "").trim().toLowerCase();
              const num = toNumber(row[preferredValueColumn] ?? "");
              return catValue === cat.trim().toLowerCase() && num !== null ? acc + 1 : acc;
            }, 0);
            return count >= MIN_SERIES_POINTS;
          })
        : [];

      let message = "";
      if (rowCount === 0) {
        message = "CSV contains no data rows.";
      } else if (!categoryHeader || parsedCategories.length === 0) {
        message = "CSV must contain a category column with non-empty values.";
      } else if (!preferredValueColumn) {
        message = "CSV must contain at least one mostly numeric column for forecasting.";
      } else if (eligibleCategories.length === 0) {
        message = `No category has at least ${MIN_SERIES_POINTS} numeric rows in '${preferredValueColumn}'.`;
      }

      setCsvStats({ rows: rowCount, cols: colCount, mismatched });
      setCsvRecords(records);
      setCategoryColumn(categoryHeader);
      setDateColumn(preferredDateColumn);
      setValueColumn(preferredValueColumn);
      setPriceColumn(preferredPriceColumn);
      setPreviewColumn(headerColumns[0] ?? "");
      setAvailableCategories(eligibleCategories);
      setCategory("");
      setValidationMessage(message);
      setUploadConfirmed(true);
    } finally {
      setTimeout(() => setConfirmingUpload(false), 700);
    }
  };

  const onRunAnalytics = () => {
    if (!hasDataSource || !uploadConfirmed || !hasValidCsv || !hasCategory || !hasEnoughSeries || !keywordAligned) return;
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

  const categorySeries = useMemo(() => {
    if (!categoryColumn || !valueColumn || !category) return [] as Array<{ date: string; value: number }>;

    const categoryRows = csvRecords.filter(
      (row) => (row[categoryColumn] ?? "").trim().toLowerCase() === category.trim().toLowerCase()
    );

    return categoryRows
      .map((row, index) => {
        const numericValue = toNumber(row[valueColumn] ?? "");
        if (numericValue === null) return null;
        const rawDate = dateColumn ? (row[dateColumn] ?? "").trim() : "";
        const parsedDate = rawDate ? new Date(rawDate) : null;
        const dateLabel = parsedDate && Number.isFinite(parsedDate.getTime())
          ? parsedDate.toISOString().slice(0, 10)
          : `row-${index + 1}`;
        return { date: dateLabel, value: numericValue };
      })
      .filter((point): point is { date: string; value: number } => point !== null);
  }, [category, categoryColumn, csvRecords, dateColumn, valueColumn]);

  const hasEnoughSeries = categorySeries.length >= MIN_SERIES_POINTS;
  const analysisBlockedMessage = !hasValidCsv
    ? validationMessage
    : !hasCategory
      ? "Select a category extracted from your CSV."
      : !hasEnoughSeries
        ? `Selected category needs at least ${MIN_SERIES_POINTS} numeric rows in '${valueColumn || "value"}'.`
        : "";

  const historySeries = hasEnoughSeries ? categorySeries.slice(-MIN_SERIES_POINTS) : [];

  const normalizedHistory = useMemo(() => {
    if (historySeries.length === 0) return [] as Array<{ date: string; value: number }>;

    const parsed = historySeries
      .map((point) => ({ date: toDateOrNull(point.date), value: point.value }))
      .filter((point): point is { date: Date; value: number } => point.date !== null)
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    const now = new Date();
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(now.getMonth() - 6);

    // Rebase stale or invalid history to a recent weekly timeline to avoid large visual gaps.
    if (parsed.length < historySeries.length || parsed.length === 0 || parsed[parsed.length - 1].date < sixMonthsAgo) {
      return historySeries.map((point, idx) => {
        const d = new Date(now);
        d.setDate(now.getDate() - (historySeries.length - 1 - idx) * 7);
        return { date: d.toISOString().slice(0, 10), value: point.value };
      });
    }

    return parsed.map((point) => ({ date: point.date.toISOString().slice(0, 10), value: point.value }));
  }, [historySeries]);

  const mockDates = normalizedHistory.map((point) => point.date);
  const hist = normalizedHistory.map((point) => Math.round(point.value));

  const lastHistDate = mockDates.length > 0 ? new Date(mockDates[mockDates.length - 1]) : new Date();
  const validLastDate = Number.isFinite(lastHistDate.getTime()) ? lastHistDate : new Date();
  const futureDates = Array.from({ length: horizon }, (_, i) => {
    const date = new Date(validLastDate);
    date.setDate(date.getDate() + (i + 1) * 7);
    return date.toISOString().slice(0, 10);
  });

  const histAvg = hist.length > 0 ? hist.reduce((sum, value) => sum + value, 0) / hist.length : 100;
  const trendSlope = hist.length > 1 ? (hist[hist.length - 1] - hist[0]) / (hist.length - 1) : 0;
  const keywordHash = hashString(cleanKeyword);
  const categoryHash = hashString(category.trim().toLowerCase());
  const scenarioHash = hashString(`${category.trim().toLowerCase()}|${cleanKeyword}|${valueColumn}`);
  const keywordFactor = 1 + (((keywordHash % 17) - 8) * 0.006) + (((categoryHash % 11) - 5) * 0.003);
  const seasonalPhase = ((scenarioHash % 360) * Math.PI) / 180;
  const slopeJitter = ((scenarioHash % 7) - 3) * 0.18;
  const amplitudeJitter = 2 + (scenarioHash % 5);

  const xgbForecast = Array.from({ length: horizon }, (_, i) => {
    const baseline = (hist[hist.length - 1] ?? histAvg) + (trendSlope + slopeJitter) * (i + 1);
    const seasonal = Math.sin((i + 1) / 2 + seasonalPhase) * (Math.abs(trendSlope) + amplitudeJitter);
    return Math.max(1, Math.round((baseline + seasonal) * keywordFactor));
  });

  const arimaForecast = xgbForecast.map((value, i) => {
    const smoothingPenalty = Math.max(1, Math.round(Math.abs(trendSlope + slopeJitter) * 0.45 + i * 0.55));
    return Math.max(1, value - smoothingPenalty);
  });

  const bestUnits = Math.max(...xgbForecast);
  const bestIndex = xgbForecast.findIndex((x) => x === bestUnits);
  const bestLaunchDate = futureDates[Math.max(bestIndex, 0)] ?? futureDates[0];

  const testDates = mockDates.slice(-8);
  const testActual = hist.slice(-8);
  const fitOffset = ((scenarioHash % 9) - 4) * 0.25;
  const arimaPred = testActual.map((v, i) => Math.max(1, Math.round(v - (1.1 + i * 0.55 + fitOffset))));
  const xgbPred = testActual.map((v, i) => Math.max(1, Math.round(v - (0.45 + i * 0.32 - fitOffset * 0.35))));

  const histMin = hist.length > 0 ? Math.min(...hist) : 0;
  const histMax = hist.length > 0 ? Math.max(...hist) : 1;
  const histRange = Math.max(histMax - histMin, 1);
  const keywordShift = ((keywordHash % 9) - 4) + ((categoryHash % 5) - 2);
  const trendsSeries = hist.map((value) => clamp(Math.round(((value - histMin) / histRange) * 70 + 20 + keywordShift), 0, 100));

  const categoryPriceValues = useMemo(() => {
    if (!priceColumn || !category || !categoryColumn) return [] as number[];
    return csvRecords
      .filter((row) => (row[categoryColumn] ?? "").trim().toLowerCase() === category.trim().toLowerCase())
      .map((row) => toNumber(row[priceColumn] ?? ""))
      .filter((value): value is number => value !== null);
  }, [category, categoryColumn, csvRecords, priceColumn]);

  const priceAnchorFromCsv = percentile(categoryPriceValues, 0.5);
  const fallbackPriceAnchor = Math.max(499, Math.round(749 + histAvg * 2 + (categoryHash % 140) - 70));
  const priceAnchor = priceAnchorFromCsv ?? fallbackPriceAnchor;
  const minPrice = Math.max(99, Math.round((priceAnchor * 0.7) / 10) * 10);
  const maxPrice = Math.max(minPrice + 90, Math.round((priceAnchor * 1.3) / 10) * 10);
  const priceStep = Math.max(10, Math.round((maxPrice - minPrice) / 9 / 10) * 10);
  const prices = Array.from({ length: 10 }, (_, i) => minPrice + i * priceStep);
  const revenue = prices.map((price, i) => {
    const demandAtPrice = Math.max(bestUnits - i * Math.max(3, Math.round(Math.abs(trendSlope) + 2)), 5);
    return Math.round(price * demandAtPrice);
  });
  const optRev = Math.max(...revenue);
  const optIdx = revenue.findIndex((r) => r === optRev);
  const optPrice = prices[Math.max(optIdx, 0)] ?? prices[0];

  const rmse = testActual.length
    ? Math.sqrt(
        testActual.reduce((sum, actual, index) => {
          const pred = xgbPred[index] ?? actual;
          return sum + (actual - pred) ** 2;
        }, 0) / testActual.length
      )
    : 0;

  const mape = testActual.length
    ? (testActual.reduce((sum, actual, index) => {
        if (actual === 0) return sum;
        const pred = xgbPred[index] ?? actual;
        return sum + Math.abs((actual - pred) / actual);
      }, 0) /
        testActual.length) *
      100
    : 0;

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
              <img
                src="/optezum-logo.svg"
                alt="Optezum"
                className="h-auto w-[280px] sm:w-[360px] md:w-[520px]"
              />
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
            <header className="rounded-2xl border border-[#eadfce] bg-[#F8F1E7] px-4 py-6 text-center shadow-sm">
              <div className="h-12 md:h-14">
                <GradientWaveText 
                  className="text-2xl md:text-3xl lg:text-4xl font-semibold"
                  speed={0.8}
                  customColors={["#0284c7", "#06b6d4", "#10b981", "#f59e0b", "#ef4444"]}
                >
                  Welcome to Optezum
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
                  {uploadConfirmed && hasCategory && keywordExamples.length > 0 && (
                    <div className="mt-2 rounded-md border border-sky-100 bg-sky-50 px-3 py-2">
                      <p className="text-xs text-sky-900">
                        Suggested for {category}: {" "}
                        {keywordExamples.map((example, idx) => (
                          <button
                            key={example}
                            type="button"
                            className="font-medium underline decoration-dotted underline-offset-2 hover:text-sky-700"
                            onClick={() => {
                              setKeyword(example);
                              setCompleted(false);
                            }}
                          >
                            {idx > 0 ? `, ${example}` : example}
                          </button>
                        ))}
                      </p>
                    </div>
                  )}
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
                          setDemoCsvContent("");
                          setCsvName(selectedName);
                          setCsvStats(null);
                          setCsvRecords([]);
                          setCategoryColumn("");
                          setDateColumn("");
                          setValueColumn("");
                          setPriceColumn("");
                          setPreviewColumn("");
                          setValidationMessage("");
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
                      disabled={(!uploadedFile && !demoCsvContent) || confirmingUpload}
                      className="h-11 min-w-40"
                      variant={uploadConfirmed ? "default" : "secondary"}
                    >
                      {confirmingUpload ? "Confirming..." : uploadConfirmed ? "Upload Confirmed" : "Confirm Upload CSV"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-2 h-11 min-w-40"
                      disabled={confirmingUpload}
                      onClick={async () => {
                        try {
                          const response = await fetch("/demo-data/optezum-demo.csv");
                          const content = await response.text();

                          setUploadedFile(null);
                          setDemoCsvContent(content);
                          setCsvName("optezum-demo.csv");
                          setCsvStats(null);
                          setCsvRecords([]);
                          setCategoryColumn("");
                          setDateColumn("");
                          setValueColumn("");
                          setPriceColumn("");
                          setPreviewColumn("");
                          setValidationMessage("");
                          setAvailableCategories([]);
                          setCategory("");
                          setUploadConfirmed(false);
                          setCompleted(false);
                          setRunning(false);
                          setProgress(0);
                          setCurrentStep(0);
                        } catch {
                          setValidationMessage("Unable to load demo CSV from /demo-data/optezum-demo.csv.");
                        }
                      }}
                    >
                      Use Demo CSV
                    </Button>
                  </div>
                </div>

                {csvStats && csvStats.mismatched && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
                    <p className="text-sm text-amber-900">
                      Some rows have column-count mismatch (header has {csvStats.cols} columns).
                      The pipeline will normalize these rows before forecasting.
                    </p>
                  </div>
                )}

                {uploadConfirmed && csvHeaders.length > 0 && (
                  <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                    <div className="grid gap-3 md:grid-cols-[240px_1fr] md:items-start">
                      <div>
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">Quick CSV Preview</label>
                        <select
                          value={previewColumn}
                          onChange={(e) => setPreviewColumn(e.target.value)}
                          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
                        >
                          {csvHeaders.map((header) => (
                            <option key={header} value={header}>
                              {header}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-600">
                              <th className="px-2 py-1.5 text-left font-semibold">Row</th>
                              <th className="px-2 py-1.5 text-left font-semibold">{previewColumn}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {previewRows.map((value, index) => (
                              <tr key={`${previewColumn}-${index}`} className="border-b border-slate-100">
                                <td className="px-2 py-1.5 text-slate-500">{index + 1}</td>
                                <td className="px-2 py-1.5 text-slate-800">{value || "-"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {validationMessage && (
                  <div className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-3">
                    <p className="text-sm text-rose-900">{validationMessage}</p>
                  </div>
                )}

                {!validationMessage && uploadConfirmed && hasCategory && !hasEnoughSeries && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
                    <p className="text-sm text-amber-900">{analysisBlockedMessage}</p>
                  </div>
                )}

                {!validationMessage && uploadConfirmed && hasCategory && !keywordAligned && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
                    <p className="text-sm text-amber-900">{keywordCategoryMessage}</p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col gap-2 sm:flex-row sm:gap-3 pt-2 border-t border-slate-200">
                  <Button 
                    onClick={onRunAnalytics} 
                    disabled={!hasDataSource || !uploadConfirmed || !hasValidCsv || !hasCategory || !hasEnoughSeries || !keywordAligned || running || confirmingUpload}
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
                      setDemoCsvContent("");
                      setCsvStats(null);
                      setCsvRecords([]);
                      setCategoryColumn("");
                      setDateColumn("");
                      setValueColumn("");
                      setPriceColumn("");
                      setPreviewColumn("");
                      setValidationMessage("");
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
                  {uploadConfirmed && valueColumn && (
                    <p className="mt-1 text-xs text-blue-800">
                      Forecast metric column: <span className="font-semibold">{valueColumn}</span>
                    </p>
                  )}
                  {uploadConfirmed && priceColumn && (
                    <p className="mt-1 text-xs text-blue-800">
                      Price anchor column: <span className="font-semibold">{priceColumn}</span>
                    </p>
                  )}
                </motion.div>
              )}
            </section>

            {/* Running Progress */}
            {running && (
              <section ref={progressSectionRef} className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Alert variant="info">
                  <AlertTitle>Pipeline running</AlertTitle>
                  <AlertDescription>
                    Processing {sourceLabel} through all 10 stages. Cleaning and analysis in progress{".".repeat(loadingDot)}
                  </AlertDescription>
                </Alert>

                <motion.div
                  initial={{ scale: 0.985, boxShadow: "0 0 0 rgba(14, 116, 144, 0)" }}
                  animate={{ scale: 1, boxShadow: "0 0 0 6px rgba(14, 116, 144, 0.08)" }}
                  transition={{ duration: 0.45, ease: "easeOut" }}
                  className="rounded-xl border bg-white p-5 shadow-sm"
                >
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
                </motion.div>
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
                    <p className="mt-3 text-3xl font-bold text-slate-900">{rmse.toFixed(2)}</p>
                    <p className="mt-1 text-xs text-emerald-700 font-medium">Computed from selected category series in CSV</p>
                  </motion.div>
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="rounded-xl border bg-white p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Forecast MAPE</p>
                    <p className="mt-3 text-3xl font-bold text-slate-900">{mape.toFixed(2)}%</p>
                    <p className="mt-1 text-xs text-emerald-700 font-medium">Computed from selected category series in CSV</p>
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
