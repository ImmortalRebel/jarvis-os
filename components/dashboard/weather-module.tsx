"use client";

import { motion } from "framer-motion";
import { HUDPanel } from "./hud-panel";

export function WeatherModule() {
  return (
    <HUDPanel title="Environment" delay={0.4}>
      <div className="flex items-center gap-4">
        {/* Animated weather icon */}
        <div className="relative w-16 h-16 flex items-center justify-center">
          {/* Sun core */}
          <motion.div
            className="absolute w-8 h-8 rounded-full bg-gradient-to-br from-yellow-300 to-orange-400"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 3, repeat: Infinity }}
            style={{
              boxShadow: "0 0 20px rgba(255, 200, 50, 0.6), 0 0 40px rgba(255, 150, 50, 0.3)",
            }}
          />
          {/* Sun rays */}
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-3 bg-gradient-to-t from-yellow-400 to-transparent rounded-full"
              style={{
                transformOrigin: "center 24px",
                rotate: `${i * 45}deg`,
              }}
              animate={{ opacity: [0.5, 1, 0.5], scale: [0.8, 1, 0.8] }}
              transition={{ duration: 2, repeat: Infinity, delay: i * 0.1 }}
            />
          ))}
        </div>

        {/* Temperature */}
        <div className="flex-1">
          <div className="flex items-start">
            <span className="text-3xl font-mono font-bold text-foreground">24</span>
            <span className="text-lg text-muted-foreground">°C</span>
          </div>
          <p className="text-xs font-mono text-cyan-glow tracking-wider">CLEAR SKY</p>
        </div>
      </div>

      {/* Additional data */}
      <div className="mt-4 pt-3 border-t border-border grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-[10px] font-mono text-muted-foreground">HUMIDITY</p>
          <p className="text-sm font-mono text-foreground">45%</p>
        </div>
        <div>
          <p className="text-[10px] font-mono text-muted-foreground">WIND</p>
          <p className="text-sm font-mono text-foreground">12 km/h</p>
        </div>
        <div>
          <p className="text-[10px] font-mono text-muted-foreground">UV</p>
          <p className="text-sm font-mono text-foreground">3</p>
        </div>
      </div>

      {/* Location */}
      <div className="mt-3 flex items-center justify-center gap-2 text-[10px] font-mono text-muted-foreground">
        <motion.div
          className="w-1.5 h-1.5 rounded-full bg-cyan-glow"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <span>SAN FRANCISCO, CA</span>
      </div>
    </HUDPanel>
  );
}
