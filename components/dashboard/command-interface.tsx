"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const recentCommands = [
  { id: 1, text: "Analyze system performance", time: "2m ago" },
  { id: 2, text: "Generate quarterly report", time: "15m ago" },
  { id: 3, text: "Scan network for threats", time: "1h ago" },
  { id: 4, text: "Optimize database queries", time: "3h ago" },
];

export function CommandInterface() {
  const [command, setCommand] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  return (
    <motion.div
      className="relative"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 }}
    >
      {/* Command input */}
      <div className="relative">
        {/* Corner accents */}
        <div className="absolute -top-1 -left-1 w-3 h-3 border-l-2 border-t-2 border-cyan-glow opacity-60" />
        <div className="absolute -top-1 -right-1 w-3 h-3 border-r-2 border-t-2 border-cyan-glow opacity-60" />
        <div className="absolute -bottom-1 -left-1 w-3 h-3 border-l-2 border-b-2 border-cyan-glow opacity-60" />
        <div className="absolute -bottom-1 -right-1 w-3 h-3 border-r-2 border-b-2 border-cyan-glow opacity-60" />

        <div className={`
          relative flex items-center gap-3 bg-card/60 backdrop-blur-md border rounded-sm px-4 py-3
          transition-all duration-300
          ${isFocused ? "border-cyan-glow glow-cyan" : "border-border"}
        `}>
          {/* Prompt indicator */}
          <motion.div
            className="flex items-center gap-2"
            animate={{ opacity: isFocused ? 1 : 0.6 }}
          >
            <motion.div
              className="w-2 h-2 rounded-full bg-cyan-glow"
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <span className="text-xs font-mono text-cyan-glow tracking-wider">NEXUS://</span>
          </motion.div>

          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Enter command or query..."
            className="flex-1 bg-transparent text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none"
          />

          {/* Submit button */}
          <motion.button
            className="relative px-4 py-1.5 bg-cyan-glow/20 border border-cyan-glow/50 rounded-sm text-xs font-mono text-cyan-glow tracking-wider"
            whileHover={{ scale: 1.05, backgroundColor: "rgba(0, 229, 255, 0.3)" }}
            whileTap={{ scale: 0.95 }}
          >
            EXECUTE
          </motion.button>
        </div>
      </div>

      {/* Recent commands dropdown */}
      <AnimatePresence>
        {isFocused && (
          <motion.div
            className="absolute top-full left-0 right-0 mt-2 bg-card/80 backdrop-blur-md border border-border rounded-sm overflow-hidden z-10"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className="px-3 py-2 border-b border-border">
              <span className="text-[10px] font-mono text-muted-foreground tracking-wider">RECENT COMMANDS</span>
            </div>
            {recentCommands.map((cmd, i) => (
              <motion.button
                key={cmd.id}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-cyan-glow/10 transition-colors text-left"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => setCommand(cmd.text)}
              >
                <span className="text-xs font-mono text-foreground">{cmd.text}</span>
                <span className="text-[10px] font-mono text-muted-foreground">{cmd.time}</span>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
