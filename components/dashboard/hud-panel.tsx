"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface HUDPanelProps {
  children: ReactNode;
  title?: string;
  className?: string;
  delay?: number;
}

export function HUDPanel({ children, title, className = "", delay = 0 }: HUDPanelProps) {
  return (
    <motion.div
      className={`relative ${className}`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay }}
    >
      {/* Corner accents */}
      <div className="absolute top-0 left-0 w-4 h-4 border-l-2 border-t-2 border-cyan-glow opacity-60" />
      <div className="absolute top-0 right-0 w-4 h-4 border-r-2 border-t-2 border-cyan-glow opacity-60" />
      <div className="absolute bottom-0 left-0 w-4 h-4 border-l-2 border-b-2 border-cyan-glow opacity-60" />
      <div className="absolute bottom-0 right-0 w-4 h-4 border-r-2 border-b-2 border-cyan-glow opacity-60" />

      {/* Panel background */}
      <div className="relative bg-card/40 backdrop-blur-md border border-border rounded p-4">
        {/* Scan line effect */}
        <motion.div
          className="absolute inset-0 overflow-hidden rounded pointer-events-none"
          initial={false}
        >
          <motion.div
            className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-glow to-transparent opacity-30"
            animate={{ y: ["-100%", "400%"] }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear", delay }}
          />
        </motion.div>

        {/* Title */}
        {title && (
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
            <motion.div
              className="w-2 h-2 rounded-full bg-cyan-glow"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <span className="text-xs font-mono tracking-[0.2em] text-cyan-glow uppercase">
              {title}
            </span>
          </div>
        )}

        {children}
      </div>
    </motion.div>
  );
}
