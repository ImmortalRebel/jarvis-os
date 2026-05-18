"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function AICore() {
  const [isActive, setIsActive] = useState(false);
  const [statusText, setStatusText] = useState("NEXUS ONLINE");

  useEffect(() => {
    const texts = ["NEXUS ONLINE", "SYSTEMS NOMINAL", "AWAITING INPUT", "READY"];
    let index = 0;
    const interval = setInterval(() => {
      index = (index + 1) % texts.length;
      setStatusText(texts[index]);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative flex items-center justify-center">
      {/* Outer rotating rings */}
      {[...Array(4)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full border"
          style={{
            width: 280 + i * 80,
            height: 280 + i * 80,
            borderColor: `rgba(0, 229, 255, ${0.15 - i * 0.03})`,
          }}
          animate={{ rotate: i % 2 === 0 ? 360 : -360 }}
          transition={{ duration: 20 + i * 10, repeat: Infinity, ease: "linear" }}
        >
          {/* Ring markers */}
          {[...Array(8)].map((_, j) => (
            <motion.div
              key={j}
              className="absolute w-2 h-2 rounded-full bg-cyan-glow"
              style={{
                top: "50%",
                left: "50%",
                transform: `rotate(${j * 45}deg) translateY(-${(280 + i * 80) / 2}px) translate(-50%, -50%)`,
                opacity: 0.4,
              }}
              animate={{ opacity: [0.2, 0.8, 0.2] }}
              transition={{ duration: 2, repeat: Infinity, delay: j * 0.2 }}
            />
          ))}
        </motion.div>
      ))}

      {/* Data ring segments */}
      <svg className="absolute w-[500px] h-[500px]" viewBox="0 0 500 500">
        {[...Array(12)].map((_, i) => (
          <motion.path
            key={i}
            d={describeArc(250, 250, 220, i * 30 + 5, i * 30 + 20)}
            fill="none"
            stroke="rgba(0, 229, 255, 0.3)"
            strokeWidth="3"
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: [0.3, 0.8, 0.3] }}
            transition={{ duration: 2, repeat: Infinity, delay: i * 0.1 }}
          />
        ))}
      </svg>

      {/* Inner HUD ring */}
      <motion.div
        className="absolute w-64 h-64 rounded-full"
        style={{
          background: "conic-gradient(from 0deg, transparent, rgba(0, 229, 255, 0.2), transparent, rgba(124, 77, 255, 0.2), transparent)",
        }}
        animate={{ rotate: -360 }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
      />

      {/* Core orb container */}
      <motion.button
        className="relative w-48 h-48 rounded-full cursor-pointer focus:outline-none"
        onClick={() => setIsActive(!isActive)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.98 }}
      >
        {/* Outer glow */}
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(0, 229, 255, 0.4) 0%, transparent 70%)",
          }}
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 3, repeat: Infinity }}
        />

        {/* Core sphere */}
        <div
          className="absolute inset-4 rounded-full"
          style={{
            background: "radial-gradient(circle at 30% 30%, rgba(0, 229, 255, 0.8), rgba(41, 121, 255, 0.6) 40%, rgba(124, 77, 255, 0.4) 70%, rgba(0, 20, 40, 0.9))",
            boxShadow: "0 0 60px rgba(0, 229, 255, 0.6), inset 0 0 60px rgba(0, 229, 255, 0.3)",
          }}
        />

        {/* Inner core */}
        <motion.div
          className="absolute inset-12 rounded-full"
          style={{
            background: "radial-gradient(circle at 40% 40%, rgba(255, 255, 255, 0.9), rgba(0, 229, 255, 0.8) 50%, transparent)",
          }}
          animate={{ scale: [0.9, 1.1, 0.9] }}
          transition={{ duration: 2, repeat: Infinity }}
        />

        {/* Active state pulse rings */}
        <AnimatePresence>
          {isActive && (
            <>
              {[...Array(3)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute inset-0 rounded-full border-2 border-cyan-glow"
                  initial={{ scale: 1, opacity: 0.8 }}
                  animate={{ scale: 2 + i * 0.5, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 2, repeat: Infinity, delay: i * 0.4 }}
                />
              ))}
            </>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Voice waveform when active */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            className="absolute -bottom-20 flex items-center justify-center gap-1"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
          >
            {[...Array(32)].map((_, i) => (
              <motion.div
                key={i}
                className="w-1 bg-gradient-to-t from-cyan-glow to-blue-glow rounded-full"
                animate={{
                  height: [8, Math.random() * 40 + 10, 8],
                }}
                transition={{
                  duration: 0.5,
                  repeat: Infinity,
                  delay: i * 0.02,
                  ease: "easeInOut",
                }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status indicator */}
      <motion.div
        className="absolute -bottom-36 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <motion.p
          className="text-xs tracking-[0.3em] text-cyan-glow text-glow-cyan font-mono"
          key={statusText}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
        >
          {statusText}
        </motion.p>
        <p className="text-[10px] text-muted-foreground mt-2 tracking-widest">
          {isActive ? "LISTENING..." : "TAP TO ACTIVATE"}
        </p>
      </motion.div>
    </div>
  );
}

// Helper function to create arc paths
function describeArc(x: number, y: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}
