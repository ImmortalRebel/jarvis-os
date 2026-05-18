"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BootSequence } from "@/components/dashboard/boot-sequence";
import { GridBackground } from "@/components/dashboard/grid-background";
import { AICore } from "@/components/dashboard/ai-core";
import { SystemMetrics } from "@/components/dashboard/system-metrics";
import { TimeDisplay } from "@/components/dashboard/time-display";
import { WeatherModule } from "@/components/dashboard/weather-module";
import { CommandInterface } from "@/components/dashboard/command-interface";
import { QuickActionsHUD } from "@/components/dashboard/quick-actions-hud";
import { ActivityLog } from "@/components/dashboard/activity-log";
import { RadialMenu } from "@/components/dashboard/radial-menu";

export default function JarvisOS() {
  const [bootComplete, setBootComplete] = useState(false);

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden">
      <AnimatePresence mode="wait">
        {!bootComplete ? (
          <BootSequence key="boot" onComplete={() => setBootComplete(true)} />
        ) : (
          <motion.div
            key="dashboard"
            className="relative w-full h-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.5 }}
          >
            {/* Animated grid background with particles */}
            <GridBackground />

            {/* Main content */}
            <div className="relative z-10 w-full h-full flex flex-col">
              {/* Top bar */}
              <motion.header
                className="flex items-center justify-between px-8 py-4"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.5 }}
              >
                <div className="flex items-center gap-3">
                  <motion.div
                    className="w-3 h-3 rounded-full bg-cyan-glow"
                    animate={{ opacity: [0.5, 1, 0.5], scale: [0.9, 1.1, 0.9] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    style={{ boxShadow: "0 0 15px rgba(0, 229, 255, 0.8)" }}
                  />
                  <span className="text-sm font-mono tracking-[0.3em] text-cyan-glow text-glow-cyan">
                    J.A.R.V.I.S
                  </span>
                  <span className="text-xs font-mono text-muted-foreground ml-2">
                    v4.2.1
                  </span>
                </div>

                <div className="flex items-center gap-6">
                  <StatusIndicator label="NEURAL" status="active" />
                  <StatusIndicator label="SECURE" status="active" />
                  <StatusIndicator label="SYNC" status="active" />
                </div>
              </motion.header>

              {/* Main grid layout */}
              <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 px-4 lg:px-8 pb-8 pt-4 overflow-auto lg:overflow-hidden">
                {/* Left column - System panels */}
                <motion.div
                  className="col-span-1 lg:col-span-3 flex flex-col gap-4 order-2 lg:order-1"
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.8, delay: 0.8 }}
                >
                  <SystemMetrics />
                  <ActivityLog />
                </motion.div>

                {/* Center column - AI Core */}
                <motion.div
                  className="col-span-1 lg:col-span-6 flex flex-col items-center justify-center relative min-h-[500px] lg:min-h-0 order-1 lg:order-2"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 1, delay: 0.3 }}
                >
                  {/* AI Core with rings */}
                  <AICore />

                  {/* Command interface below the orb */}
                  <div className="absolute bottom-4 lg:bottom-8 left-4 lg:left-8 right-4 lg:right-8">
                    <CommandInterface />
                  </div>
                </motion.div>

                {/* Right column - Info panels */}
                <motion.div
                  className="col-span-1 lg:col-span-3 flex flex-col gap-4 order-3"
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.8, delay: 0.8 }}
                >
                  <TimeDisplay />
                  <WeatherModule />
                  <QuickActionsHUD />
                </motion.div>
              </div>
            </div>

            {/* Radial navigation menu */}
            <RadialMenu />

            {/* Corner decorations */}
            <CornerDecoration position="top-left" />
            <CornerDecoration position="top-right" />
            <CornerDecoration position="bottom-left" />
            <CornerDecoration position="bottom-right" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatusIndicator({
  label,
  status,
}: {
  label: string;
  status: "active" | "warning" | "error";
}) {
  const colors = {
    active: "bg-cyan-glow",
    warning: "bg-yellow-400",
    error: "bg-red-500",
  };

  return (
    <div className="flex items-center gap-2">
      <motion.div
        className={`w-1.5 h-1.5 rounded-full ${colors[status]}`}
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
      <span className="text-[10px] font-mono tracking-wider text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

function CornerDecoration({
  position,
}: {
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
}) {
  const positionClasses = {
    "top-left": "top-4 left-4",
    "top-right": "top-4 right-4 rotate-90",
    "bottom-left": "bottom-4 left-4 -rotate-90",
    "bottom-right": "bottom-4 right-4 rotate-180",
  };

  return (
    <motion.div
      className={`fixed ${positionClasses[position]} pointer-events-none hidden lg:block`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 1.5 }}
    >
      <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
        <motion.path
          d="M0 20 L0 0 L20 0"
          stroke="rgba(0, 229, 255, 0.4)"
          strokeWidth="2"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1, delay: 1.7 }}
        />
        <motion.path
          d="M0 30 L0 10 L10 10"
          stroke="rgba(0, 229, 255, 0.2)"
          strokeWidth="1"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.8, delay: 1.9 }}
        />
        <motion.circle
          cx="5"
          cy="5"
          r="2"
          fill="rgba(0, 229, 255, 0.6)"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.3, 0.8, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, delay: 2 }}
        />
      </svg>
    </motion.div>
  );
}
