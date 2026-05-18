"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { HUDPanel } from "./hud-panel";

export function TimeDisplay() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hours = time.getHours().toString().padStart(2, "0");
  const minutes = time.getMinutes().toString().padStart(2, "0");
  const seconds = time.getSeconds().toString().padStart(2, "0");

  const formatDate = () => {
    return time.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "2-digit",
      year: "numeric",
    }).toUpperCase();
  };

  return (
    <HUDPanel title="Temporal Data" delay={0.3}>
      <div className="text-center">
        {/* Main time display */}
        <div className="flex items-center justify-center gap-1 font-mono">
          <motion.span
            className="text-4xl font-bold text-cyan-glow text-glow-cyan"
            key={`hours-${hours}`}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {hours}
          </motion.span>
          <motion.span
            className="text-4xl font-bold text-cyan-glow"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            :
          </motion.span>
          <motion.span
            className="text-4xl font-bold text-cyan-glow text-glow-cyan"
            key={`minutes-${minutes}`}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {minutes}
          </motion.span>
          <motion.span
            className="text-4xl font-bold text-cyan-glow"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            :
          </motion.span>
          <motion.span
            className="text-2xl text-blue-glow text-glow-blue font-bold mt-1"
            key={`seconds-${seconds}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {seconds}
          </motion.span>
        </div>

        {/* Date display */}
        <p className="text-xs font-mono text-muted-foreground tracking-[0.2em] mt-2">
          {formatDate()}
        </p>

        {/* Timezone */}
        <div className="mt-3 pt-3 border-t border-border flex justify-between text-[10px] font-mono text-muted-foreground">
          <span>ZONE</span>
          <span className="text-foreground">
            {Intl.DateTimeFormat().resolvedOptions().timeZone.split("/").pop()}
          </span>
        </div>
      </div>
    </HUDPanel>
  );
}
