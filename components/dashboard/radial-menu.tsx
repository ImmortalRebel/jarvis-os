"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const menuItems = [
  { id: 1, label: "Dashboard", icon: "⬡" },
  { id: 2, label: "Analytics", icon: "◎" },
  { id: 3, label: "Security", icon: "◆" },
  { id: 4, label: "Network", icon: "◈" },
  { id: 5, label: "Storage", icon: "▣" },
  { id: 6, label: "Settings", icon: "⚙" },
];

export function RadialMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeItem, setActiveItem] = useState(1);

  return (
    <div className="fixed bottom-8 left-8 z-50">
      {/* Menu trigger */}
      <motion.button
        className="relative w-14 h-14 rounded-full bg-card/80 backdrop-blur-md border border-cyan-glow/50 flex items-center justify-center"
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        animate={{
          boxShadow: isOpen
            ? "0 0 30px rgba(0, 229, 255, 0.5)"
            : "0 0 15px rgba(0, 229, 255, 0.2)",
        }}
      >
        <motion.div
          className="text-cyan-glow text-xl"
          animate={{ rotate: isOpen ? 45 : 0 }}
        >
          ✦
        </motion.div>
      </motion.button>

      {/* Radial menu items */}
      <AnimatePresence>
        {isOpen && (
          <>
            {menuItems.map((item, i) => {
              const angle = (i * 60 - 90) * (Math.PI / 180);
              const radius = 80;
              const x = Math.cos(angle) * radius;
              const y = Math.sin(angle) * radius;

              return (
                <motion.button
                  key={item.id}
                  className={`
                    absolute w-12 h-12 rounded-full backdrop-blur-md border flex items-center justify-center
                    transition-colors duration-200
                    ${activeItem === item.id
                      ? "bg-cyan-glow/30 border-cyan-glow text-cyan-glow"
                      : "bg-card/60 border-border text-muted-foreground hover:border-cyan-glow/50 hover:text-foreground"
                    }
                  `}
                  style={{ left: 4, top: 4 }}
                  initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
                  animate={{ x, y, opacity: 1, scale: 1 }}
                  exit={{ x: 0, y: 0, opacity: 0, scale: 0 }}
                  transition={{ delay: i * 0.05, type: "spring", stiffness: 300, damping: 20 }}
                  onClick={() => setActiveItem(item.id)}
                  whileHover={{ scale: 1.15 }}
                >
                  <span className="text-lg">{item.icon}</span>
                </motion.button>
              );
            })}

            {/* Connection lines */}
            <svg
              className="absolute w-48 h-48 pointer-events-none"
              style={{ left: -68, top: -68 }}
            >
              {menuItems.map((_, i) => {
                const angle = (i * 60 - 90) * (Math.PI / 180);
                const endX = 96 + Math.cos(angle) * 80;
                const endY = 96 + Math.sin(angle) * 80;

                return (
                  <motion.line
                    key={i}
                    x1={96}
                    y1={96}
                    x2={endX}
                    y2={endY}
                    stroke="rgba(0, 229, 255, 0.2)"
                    strokeWidth={1}
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    exit={{ pathLength: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.3 }}
                  />
                );
              })}
            </svg>
          </>
        )}
      </AnimatePresence>

      {/* Active item label */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="absolute left-20 top-1/2 -translate-y-1/2 px-3 py-1 bg-card/80 backdrop-blur-md border border-border rounded"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
          >
            <span className="text-xs font-mono text-cyan-glow tracking-wider">
              {menuItems.find((m) => m.id === activeItem)?.label.toUpperCase()}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
