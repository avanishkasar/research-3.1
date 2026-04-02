"use client";

import { motion } from "framer-motion";
import { Search } from "lucide-react";

interface AnimatedSearchBarProps {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function AnimatedSearchBar({ label, value, placeholder, onChange, disabled = false }: AnimatedSearchBarProps) {
  return (
    <div className="w-full">
      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</label>
      <motion.div
        whileFocus={disabled ? undefined : { scale: 1.01 }}
        className={`flex items-center gap-2 rounded-xl border bg-background px-3 py-2 shadow-sm ${
          disabled ? "cursor-not-allowed opacity-70" : "focus-within:ring-2 focus-within:ring-ring"
        }`}
      >
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full bg-transparent text-sm outline-none disabled:cursor-not-allowed"
        />
      </motion.div>
    </div>
  );
}
