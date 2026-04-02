"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Circle, CircleDotDashed } from "lucide-react";

const defaultSteps = [
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

interface PlanProps {
  currentStep?: number;
  completed?: boolean;
  steps?: string[];
}

export default function Plan({ currentStep = 0, completed = false, steps = defaultSteps }: PlanProps) {
  const boundedStep = Math.max(0, Math.min(currentStep, steps.length));

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground">Execution Plan (10 Stages)</h3>
        <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
          {completed ? "10/10 complete" : `${boundedStep}/10 complete`}
        </span>
      </div>

      <ul className="space-y-2">
        {steps.map((step, idx) => {
          const stepNumber = idx + 1;
          const status = completed || stepNumber < boundedStep ? "completed" : stepNumber === boundedStep ? "in-progress" : "pending";

          return (
            <motion.li
              key={step}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: idx * 0.04 }}
              className="flex items-center gap-3 rounded-lg border bg-background px-3 py-2"
            >
              {status === "completed" && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
              {status === "in-progress" && <CircleDotDashed className="h-4 w-4 text-sky-600" />}
              {status === "pending" && <Circle className="h-4 w-4 text-muted-foreground" />}
              <span className="w-6 text-xs font-semibold text-muted-foreground">{stepNumber}.</span>
              <span className="text-sm">{step}</span>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}
