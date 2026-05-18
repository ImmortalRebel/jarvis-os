"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { HUDPanel } from "./hud-panel";

interface MetricData {
  label: string;
  value: number;
  unit: string;
  color: string;
}

export function SystemMetrics() {
  const [metrics, setMetrics] = useState<MetricData[]>([
    { label: "CPU", value: 42, unit: "%", color: "cyan" },
    { label: "MEM", value: 67, unit: "%", color: "blue" },
    { label: "NET", value: 128, unit: "Mb/s", color: "purple" },
    { label: "GPU", value: 23, unit: "%", color: "cyan" },
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics((prev) =>
        prev.map((m) => ({
          ...m,
          value: Math.max(5, Math.min(95, m.value + (Math.random() - 0.5) * 10)),
        }))
      );
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const getColor = (color: string) => {
    switch (color) {
      case "cyan":
        return "rgb(0, 229, 255)";
      case "blue":
        return "rgb(41, 121, 255)";
      case "purple":
        return "rgb(124, 77, 255)";
      default:
        return "rgb(0, 229, 255)";
    }
  };

  return (
    <HUDPanel title="System Status" delay={0.2}>
      <div className="space-y-4">
        {metrics.map((metric, i) => (
          <div key={metric.label} className="space-y-1">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-muted-foreground tracking-wider">{metric.label}</span>
              <motion.span
                className="text-foreground tabular-nums"
                key={metric.value}
                initial={{ opacity: 0.5 }}
                animate={{ opacity: 1 }}
              >
                {metric.value.toFixed(0)}{metric.unit}
              </motion.span>
            </div>
            <div className="relative h-1.5 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ backgroundColor: getColor(metric.color) }}
                initial={{ width: 0 }}
                animate={{ width: `${metric.value}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full opacity-50 blur-sm"
                style={{ backgroundColor: getColor(metric.color) }}
                animate={{ width: `${metric.value}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Mini data readout */}
      <div className="mt-4 pt-3 border-t border-border grid grid-cols-2 gap-2 text-[10px] font-mono text-muted-foreground">
        <div className="flex justify-between">
          <span>UPTIME</span>
          <span className="text-foreground">47:23:11</span>
        </div>
        <div className="flex justify-between">
          <span>TEMP</span>
          <span className="text-foreground">42°C</span>
        </div>
        <div className="flex justify-between">
          <span>CORES</span>
          <span className="text-foreground">16</span>
        </div>
        <div className="flex justify-between">
          <span>THREADS</span>
          <span className="text-foreground">32</span>
        </div>
      </div>
    </HUDPanel>
  );
}
