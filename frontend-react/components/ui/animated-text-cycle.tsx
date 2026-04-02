"use client";

import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface AnimatedTextCycleProps {
  words: string[];
  interval?: number;
  className?: string;
}

export default function AnimatedTextCycle({
  words,
  interval = 2800,
  className = "",
}: AnimatedTextCycleProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [width, setWidth] = useState("auto");
  const measureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!measureRef.current) return;
    const currentNode = measureRef.current.children[currentIndex] as HTMLElement | undefined;
    if (currentNode) setWidth(`${currentNode.getBoundingClientRect().width}px`);
  }, [currentIndex]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % words.length);
    }, interval);
    return () => clearInterval(timer);
  }, [interval, words.length]);

  return (
    <>
      <div ref={measureRef} aria-hidden="true" className="pointer-events-none absolute opacity-0" style={{ visibility: "hidden" }}>
        {words.map((word, i) => (
          <span key={i} className={`font-semibold ${className}`}>
            {word}
          </span>
        ))}
      </div>

      <motion.span className="relative inline-block" animate={{ width }} transition={{ type: "spring", stiffness: 170, damping: 16 }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={currentIndex}
            className={`inline-block ${className}`}
            initial={{ y: -10, opacity: 0, filter: "blur(4px)" }}
            animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
            exit={{ y: 10, opacity: 0, filter: "blur(4px)" }}
            transition={{ duration: 0.28 }}
            style={{ whiteSpace: "nowrap" }}
          >
            {words[currentIndex]}
          </motion.span>
        </AnimatePresence>
      </motion.span>
    </>
  );
}
