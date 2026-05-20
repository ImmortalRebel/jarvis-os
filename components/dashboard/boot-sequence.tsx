"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface BootSequenceProps {
  onComplete: () => void;
}

export function BootSequence({ onComplete }: BootSequenceProps) {
  const [phase, setPhase] = useState(0);
  const [systemLines, setSystemLines] = useState<string[]>([]);

  const initLines = [
    "INITIALIZING CORE SYSTEMS...",
    "LOADING NEURAL MATRIX...",
    "QUANTUM PROCESSORS: ONLINE",
    "MEMORY BANKS: 128TB ALLOCATED",
    "SECURITY PROTOCOLS: ENGAGED",
    "VOICE SYNTHESIS: CALIBRATED",
    "HOLOGRAPHIC INTERFACE: READY",
    "ALL SYSTEMS NOMINAL",
  ];

  useEffect(() => {
    const timeline = [
      { delay: 500, action: () => setPhase(1) },
      { delay: 1500, action: () => setPhase(2) },
      { delay: 3500, action: () => setPhase(3) },
      { delay: 5500, action: () => setPhase(4) },
      { delay: 7500, action: () => setPhase(5) },
      { delay: 10000, action: onComplete },
    ];

    const timers = timeline.map(({ delay, action }) =>
      setTimeout(action, delay)
    );

    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  useEffect(() => {
    if (phase >= 2) {
      let lineIndex = 0;
      const interval = setInterval(() => {
        if (lineIndex < initLines.length) {
          setSystemLines((prev) => [...prev, initLines[lineIndex]]);
          lineIndex++;
        } else {
          clearInterval(interval);
        }
      }, 200);
      return () => clearInterval(interval);
    }
  }, [phase]);

  return (
    <motion.div
      className="fixed inset-0 z-50 bg-black flex items-center justify-center overflow-hidden"
      exit={{ opacity: 0 }}
      transition={{ duration: 1 }}
    >
      {/* Floating particles background */}
      <ParticleField />

      {/* Scanlines overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 229, 255, 0.1) 2px, rgba(0, 229, 255, 0.1) 4px)",
        }}
      />

      {/* Phase 1: Initial particles and ambient glow */}
      <AnimatePresence>
        {phase >= 1 && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
          >
            <motion.div
              className="absolute w-[600px] h-[600px] rounded-full"
              style={{
                background:
                  "radial-gradient(circle, rgba(0, 229, 255, 0.1) 0%, transparent 60%)",
              }}
              animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
              transition={{ duration: 4, repeat: Infinity }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phase 2: System initialization text */}
      <AnimatePresence>
        {phase >= 2 && phase < 4 && (
          <motion.div
            className="absolute left-8 top-1/2 -translate-y-1/2 font-mono text-xs max-w-md"
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.5 }}
          >
            {systemLines.map((line, i) => (
              <motion.div
                key={i}
                className="flex items-center gap-2 mb-1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
              >
                <motion.span
                  className="text-cyan-glow"
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 0.5, repeat: 2 }}
                >
                  {">"}
                </motion.span>
                <span className="text-cyan-glow/70">{line}</span>
                {i === systemLines.length - 1 && (
                  <motion.span
                    className="inline-block w-2 h-4 bg-cyan-glow ml-1"
                    animate={{ opacity: [1, 0, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                  />
                )}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phase 3: HUD rings appear */}
      <AnimatePresence>
        {phase >= 3 && (
          <motion.div
            className="absolute"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
          >
            {/* Outer rings */}
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute rounded-full border"
                style={{
                  width: 200 + i * 100,
                  height: 200 + i * 100,
                  left: -(200 + i * 100) / 2,
                  top: -(200 + i * 100) / 2,
                  borderColor: `rgba(0, 229, 255, ${0.3 - i * 0.05})`,
                }}
                initial={{ scale: 0, opacity: 0, rotate: 0 }}
                animate={{
                  scale: 1,
                  opacity: 1,
                  rotate: i % 2 === 0 ? 360 : -360,
                }}
                transition={{
                  scale: { duration: 1, delay: i * 0.15 },
                  opacity: { duration: 0.5, delay: i * 0.15 },
                  rotate: { duration: 30 + i * 10, repeat: Infinity, ease: "linear" },
                }}
              />
            ))}

            {/* Arc segments */}
            <svg
              className="absolute"
              style={{ width: 600, height: 600, left: -300, top: -300 }}
              viewBox="0 0 600 600"
            >
              {[...Array(16)].map((_, i) => (
                <motion.path
                  key={i}
                  d={describeArc(300, 300, 250, i * 22.5 + 2, i * 22.5 + 18)}
                  fill="none"
                  stroke="rgba(0, 229, 255, 0.5)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: [0.3, 0.8, 0.3] }}
                  transition={{
                    pathLength: { duration: 1, delay: 0.5 + i * 0.05 },
                    opacity: { duration: 2, repeat: Infinity, delay: i * 0.1 },
                  }}
                />
              ))}
            </svg>

            {/* Rotating data ring */}
            <motion.div
              className="absolute w-[400px] h-[400px] left-[-200px] top-[-200px] rounded-full"
              style={{
                background:
                  "conic-gradient(from 0deg, transparent, rgba(0, 229, 255, 0.3), transparent, rgba(124, 77, 255, 0.3), transparent)",
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phase 4: AI Core powers on */}
      <AnimatePresence>
        {phase >= 4 && (
          <motion.div
            className="absolute flex flex-col items-center"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Core glow burst */}
            <motion.div
              className="absolute w-64 h-64 rounded-full"
              style={{
                background:
                  "radial-gradient(circle, rgba(0, 229, 255, 0.8) 0%, rgba(0, 229, 255, 0.3) 30%, transparent 60%)",
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 2, 1.5], opacity: [0, 1, 0.6] }}
              transition={{ duration: 1.5 }}
            />

            {/* Core sphere */}
            <motion.div
              className="relative w-40 h-40 rounded-full"
              style={{
                background:
                  "radial-gradient(circle at 30% 30%, rgba(0, 229, 255, 0.9), rgba(41, 121, 255, 0.7) 40%, rgba(124, 77, 255, 0.5) 70%, rgba(0, 20, 40, 0.95))",
                boxShadow:
                  "0 0 80px rgba(0, 229, 255, 0.8), 0 0 120px rgba(0, 229, 255, 0.4), inset 0 0 60px rgba(0, 229, 255, 0.4)",
              }}
              animate={{ scale: [0.95, 1.05, 0.95] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              {/* Inner light core */}
              <motion.div
                className="absolute inset-8 rounded-full"
                style={{
                  background:
                    "radial-gradient(circle at 40% 40%, rgba(255, 255, 255, 0.95), rgba(0, 229, 255, 0.8) 50%, transparent)",
                }}
                animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.8, 1, 0.8] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </motion.div>

            {/* Expanding pulse rings */}
            {[...Array(3)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-40 h-40 rounded-full border-2 border-cyan-glow"
                initial={{ scale: 1, opacity: 0.8 }}
                animate={{ scale: [1, 3], opacity: [0.8, 0] }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: i * 0.6,
                  ease: "easeOut",
                }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phase 5: JARVIS ACTIVATING text */}
      <AnimatePresence>
        {phase >= 4 && (
          <motion.div
            className="absolute bottom-1/4 flex flex-col items-center"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.5 }}
          >
            <motion.h1
              className="text-4xl md:text-6xl font-light tracking-[0.5em] text-cyan-glow text-glow-cyan"
              initial={{ opacity: 0, letterSpacing: "1em" }}
              animate={{ opacity: 1, letterSpacing: "0.5em" }}
              transition={{ duration: 1.5 }}
            >
              JARVIS
            </motion.h1>
            <motion.div
              className="flex items-center gap-3 mt-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
            >
              <motion.div
                className="h-[1px] w-16 bg-gradient-to-r from-transparent to-cyan-glow"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.8, delay: 1.2 }}
              />
              <motion.span
                className="text-sm tracking-[0.4em] text-cyan-glow/80 font-mono"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0.8, 1] }}
                transition={{ duration: 1.5, delay: 1 }}
              >
                ACTIVATING
              </motion.span>
              <motion.div
                className="h-[1px] w-16 bg-gradient-to-l from-transparent to-cyan-glow"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.8, delay: 1.2 }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phase 5: Welcome message */}
      <AnimatePresence>
        {phase >= 5 && (
          <motion.div
            className="absolute bottom-16 flex flex-col items-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1 }}
          >
            <motion.p
              className="text-lg md:text-xl text-foreground/90 font-light tracking-widest"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              Welcome back,{" "}
              <motion.span
                className="text-cyan-glow text-glow-cyan"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
              >
                Boss.
              </motion.span>
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Corner HUD elements */}
      <HUDCorners phase={phase} />
    </motion.div>
  );
}

function ParticleField() {
  const [particles, setParticles] = useState<Array<{ id: number; left: number; top: number; duration: number; delay: number }>>([]);

  useEffect(() => {
    const generatedParticles = [...Array(50)].map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      duration: 3 + Math.random() * 4,
      delay: Math.random() * 2,
    }));

    setParticles(generatedParticles);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute w-1 h-1 rounded-full bg-cyan-glow/30"
          style={{
            left: `${particle.left}%`,
            top: `${particle.top}%`,
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0.2, 0.6, 0.2],
            scale: [1, 1.5, 1],
          }}
          transition={{
            duration: particle.duration,
            repeat: Infinity,
            delay: particle.delay,
          }}
        />
      ))}
    </div>
  );
}

function HUDCorners({ phase }: { phase: number }) {
  if (phase < 2) return null;

  return (
    <>
      {/* Top left */}
      <motion.div
        className="absolute top-6 left-6"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.5 }}
      >
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
          <motion.path
            d="M0 30 L0 0 L30 0"
            stroke="rgba(0, 229, 255, 0.6)"
            strokeWidth="2"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1 }}
          />
          <motion.circle
            cx="4"
            cy="4"
            r="2"
            fill="rgba(0, 229, 255, 0.8)"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </svg>
      </motion.div>

      {/* Top right */}
      <motion.div
        className="absolute top-6 right-6"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.6 }}
      >
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
          <motion.path
            d="M80 30 L80 0 L50 0"
            stroke="rgba(0, 229, 255, 0.6)"
            strokeWidth="2"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1 }}
          />
          <motion.circle
            cx="76"
            cy="4"
            r="2"
            fill="rgba(0, 229, 255, 0.8)"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
          />
        </svg>
      </motion.div>

      {/* Bottom left */}
      <motion.div
        className="absolute bottom-6 left-6"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.7 }}
      >
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
          <motion.path
            d="M0 50 L0 80 L30 80"
            stroke="rgba(0, 229, 255, 0.6)"
            strokeWidth="2"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1 }}
          />
          <motion.circle
            cx="4"
            cy="76"
            r="2"
            fill="rgba(0, 229, 255, 0.8)"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2, repeat: Infinity, delay: 0.6 }}
          />
        </svg>
      </motion.div>

      {/* Bottom right */}
      <motion.div
        className="absolute bottom-6 right-6"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.8 }}
      >
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
          <motion.path
            d="M80 50 L80 80 L50 80"
            stroke="rgba(0, 229, 255, 0.6)"
            strokeWidth="2"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1 }}
          />
          <motion.circle
            cx="76"
            cy="76"
            r="2"
            fill="rgba(0, 229, 255, 0.8)"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2, repeat: Infinity, delay: 0.9 }}
          />
        </svg>
      </motion.div>
    </>
  );
}

// Helper functions for arc paths
function describeArc(
  x: number,
  y: number,
  radius: number,
  startAngle: number,
  endAngle: number
) {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

function polarToCartesian(
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number
) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}
