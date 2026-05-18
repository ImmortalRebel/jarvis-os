"use client";

import { motion } from "framer-motion";
import { HUDPanel } from "./hud-panel";

const activities = [
  { id: 1, type: "success", message: "Security scan completed", time: "00:42:11" },
  { id: 2, type: "info", message: "Neural network updated", time: "00:38:45" },
  { id: 3, type: "warning", message: "Memory usage elevated", time: "00:35:22" },
  { id: 4, type: "success", message: "Backup synchronized", time: "00:30:18" },
  { id: 5, type: "info", message: "New data patterns detected", time: "00:25:03" },
];

export function ActivityLog() {
  const getTypeStyles = (type: string) => {
    switch (type) {
      case "success":
        return { color: "rgb(0, 229, 255)", symbol: "●" };
      case "warning":
        return { color: "rgb(255, 200, 50)", symbol: "▲" };
      case "error":
        return { color: "rgb(255, 100, 100)", symbol: "✕" };
      default:
        return { color: "rgb(41, 121, 255)", symbol: "◆" };
    }
  };

  return (
    <HUDPanel title="Activity Log" className="h-full" delay={0.6}>
      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
        {activities.map((activity, i) => {
          const styles = getTypeStyles(activity.type);
          return (
            <motion.div
              key={activity.id}
              className="flex items-start gap-2 py-1.5 border-b border-border/50 last:border-0"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 + i * 0.05 }}
            >
              <motion.span
                style={{ color: styles.color }}
                className="text-xs mt-0.5"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity, delay: i * 0.2 }}
              >
                {styles.symbol}
              </motion.span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono text-foreground truncate">
                  {activity.message}
                </p>
                <p className="text-[10px] font-mono text-muted-foreground">
                  {activity.time}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </HUDPanel>
  );
}
