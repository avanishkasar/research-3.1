"use client";

import { motion, useReducedMotion } from "framer-motion";
import { GithubIcon } from "lucide-react";

const REPO_URL = "https://github.com/avanishkasar/ML-Research";

export function FooterSection() {
  return (
    <footer className="relative mx-auto mt-10 w-full max-w-6xl rounded-t-3xl border-t bg-muted/40 px-6 py-10">
      <div className="grid gap-8 md:grid-cols-4">
        <AnimatedContainer>
          <a href={REPO_URL} target="_blank" rel="noreferrer" aria-label="GitHub repository" className="inline-flex">
            <GithubIcon className="mb-3 h-7 w-7" />
          </a>
          <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} Forecast Studio</p>
        </AnimatedContainer>
        <AnimatedContainer delay={0.15}>
          <h4 className="text-xs font-semibold uppercase text-muted-foreground">Product</h4>
          <ul className="mt-2 space-y-1 text-sm">
            <li><a href={REPO_URL} target="_blank" rel="noreferrer" className="hover:underline">Features</a></li>
            <li><a href={REPO_URL} target="_blank" rel="noreferrer" className="hover:underline">Pricing</a></li>
            <li><a href={REPO_URL} target="_blank" rel="noreferrer" className="hover:underline">Roadmap</a></li>
          </ul>
        </AnimatedContainer>
        <AnimatedContainer delay={0.25}>
          <h4 className="text-xs font-semibold uppercase text-muted-foreground">Company</h4>
          <ul className="mt-2 space-y-1 text-sm">
            <li><a href={REPO_URL} target="_blank" rel="noreferrer" className="hover:underline">About</a></li>
            <li><a href={REPO_URL} target="_blank" rel="noreferrer" className="hover:underline">Privacy</a></li>
          </ul>
        </AnimatedContainer>
        <AnimatedContainer delay={0.35}>
          <h4 className="text-xs font-semibold uppercase text-muted-foreground">Social</h4>
          <div className="mt-2 flex gap-3 text-muted-foreground">
            <a href={REPO_URL} target="_blank" rel="noreferrer" aria-label="GitHub" className="hover:text-foreground">
              <GithubIcon className="h-4 w-4" />
            </a>
          </div>
        </AnimatedContainer>
      </div>
    </footer>
  );
}

function AnimatedContainer({ children, delay = 0.1 }: { children: React.ReactNode; delay?: number }) {
  const reduce = useReducedMotion();
  if (reduce) return <div>{children}</div>;
  return (
    <motion.div
      initial={{ opacity: 0, y: -6, filter: "blur(4px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay }}
    >
      {children}
    </motion.div>
  );
}
