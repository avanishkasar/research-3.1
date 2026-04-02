"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { motion } from "framer-motion";

interface AnimatedDownloadProps {
  isAnimating: boolean;
}

export function AnimatedDownload({ isAnimating }: AnimatedDownloadProps) {
  const [progress, setProgress] = useState(0);
  const [files, setFiles] = useState(0);

  useEffect(() => {
    if (!isAnimating) {
      setProgress(0);
      setFiles(0);
      return;
    }
    const id = setInterval(() => {
      setProgress((p) => {
        const next = Math.min(100, p + 2);
        setFiles(Math.floor(next * 12));
        if (next >= 100) clearInterval(id);
        return next;
      });
    }, 45);
    return () => clearInterval(id);
  }, [isAnimating]);

  return (
    <div className="w-full max-w-xl rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <motion.div animate={isAnimating ? { y: [0, 5, 0] } : { y: 0 }} transition={{ duration: 1.3, repeat: isAnimating ? Infinity : 0 }}>
          <ChevronDown className="h-5 w-5 text-primary" />
        </motion.div>
        <p className="font-mono text-sm font-semibold">{isAnimating ? "UPLOADING CSV..." : "READY FOR CSV"}</p>
      </div>
      <div className="h-2 w-full rounded-full bg-muted">
        <motion.div className="h-2 rounded-full bg-foreground" animate={{ width: `${progress}%` }} transition={{ duration: 0.2 }} />
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
        <span>{progress}%</span>
        <span>rows parsed: {files}</span>
      </div>
    </div>
  );
}
