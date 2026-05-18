"use client";

import { motion } from "framer-motion";
import { HUDPanel } from "./hud-panel";

const actions = [
  { id: 1, label: "SCAN", icon: "◎", color: "cyan" },
  { id: 2, label: "ANALYZE", icon: "◈", color: "blue" },
  { id: 3, label: "SECURE", icon: "◆", color: "purple" },
  { id: 4, label: "OPTIMIZE", icon: "◇", color: "cyan" },
  { id: 5, label: "REPORT", icon: "▣", color: "blue" },
  { id: 6, label: "BACKUP", icon: "▤", color: "purple" },
];

export function QuickActionsHUD() {
  const getColorClass = (color: string) => {
    switch (color) {
      case "cyan":
        return "border-cyan-glow text-cyan-glow hover:bg-cyan-glow/20";
      case "blue":
        return "border-blue-glow text-blue-glow hover:bg-blue-glow/20";
      case "purple":
        return "border-purple-glow text-purple-glow hover:bg-purple-glow/20";
      default:
        return "border-cyan-glow text-cyan-glow hover:bg-cyan-glow/20";
    }
  };

  return (
    <HUDPanel title="Quick Actions" delay={0.5}>
      <div className="grid grid-cols-3 gap-2">
        {actions.map((action, i) => (
          <motion.button
            key={action.id}
            className={`
              relative flex flex-col items-center justify-center gap-1 p-3 
              border rounded-sm bg-transparent
              transition-colors duration-200
              ${getColorClass(action.color)}
            `}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6 + i * 0.05 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <span className="text-lg">{action.icon}</span>
            <span className="text-[9px] font-mono tracking-wider">{action.label}</span>
          </motion.button>
        ))}
      </div>
    </HUDPanel>
  );
}
