"use client";

// Port of Animate UI's Particles primitive
// (packages/react/src/primitives/effects/particles/index.tsx), same props and
// geometry. Dropped here: the asChild/inView plumbing — the app drives `animate`
// itself and never needs in-view gating. Reduced motion comes from Motion.

import * as React from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type HTMLMotionProps,
} from "motion/react";

type Side = "top" | "bottom" | "left" | "right";
type Align = "start" | "center" | "end";

const ParticlesContext = React.createContext<{ animate: boolean } | null>(null);

function useParticles() {
  const context = React.useContext(ParticlesContext);
  if (!context) {
    throw new Error("ParticlesEffect must be used within <Particles>.");
  }
  return context;
}

type ParticlesProps = Omit<HTMLMotionProps<"div">, "children"> & {
  animate?: boolean;
  children: React.ReactNode;
};

function Particles({ animate = true, children, style, ...props }: ParticlesProps) {
  const value = React.useMemo(() => ({ animate }), [animate]);

  return (
    <ParticlesContext.Provider value={value}>
      <motion.div style={{ position: "relative", ...style }} {...props}>
        {children}
      </motion.div>
    </ParticlesContext.Provider>
  );
}

type ParticlesEffectProps = Omit<HTMLMotionProps<"div">, "children"> & {
  side?: Side;
  align?: Align;
  count?: number;
  radius?: number;
  spread?: number;
  duration?: number;
  holdDelay?: number;
  sideOffset?: number;
  alignOffset?: number;
  delay?: number;
};

function ParticlesEffect({
  side = "top",
  align = "center",
  count = 6,
  radius = 30,
  spread = 360,
  duration = 0.8,
  holdDelay = 0.05,
  sideOffset = 0,
  alignOffset = 0,
  delay = 0,
  transition,
  style,
  ...props
}: ParticlesEffectProps) {
  const { animate } = useParticles();
  const reduce = useReducedMotion();

  const isVertical = side === "top" || side === "bottom";
  const alignPct = align === "start" ? "0%" : align === "end" ? "100%" : "50%";

  const top = isVertical
    ? side === "top"
      ? `calc(0% - ${sideOffset}px)`
      : `calc(100% + ${sideOffset}px)`
    : `calc(${alignPct} + ${alignOffset}px)`;

  const left = isVertical
    ? `calc(${alignPct} + ${alignOffset}px)`
    : side === "left"
      ? `calc(0% - ${sideOffset}px)`
      : `calc(100% + ${sideOffset}px)`;

  const containerStyle: React.CSSProperties = {
    position: "absolute",
    top,
    left,
    transform: "translate(-50%, -50%)",
  };

  const fullCircle = spread % 360 === 0 && spread !== 0;
  const angleStep =
    (spread * (Math.PI / 180)) /
    (fullCircle ? Math.max(1, count) : Math.max(1, count - 1));

  return (
    <AnimatePresence>
      {animate &&
        !reduce &&
        [...Array(count)].map((_, i) => {
          const angle = i * angleStep;
          const x = Math.round(Math.cos(angle) * radius * 100) / 100;
          const y = Math.round(Math.sin(angle) * radius * 100) / 100;

          return (
            <motion.div
              key={i}
              style={{ ...containerStyle, ...style }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{
                x: `${x}px`,
                y: `${y}px`,
                scale: [0, 1, 0],
                opacity: [0, 1, 0],
              }}
              transition={{
                duration,
                delay: delay + i * holdDelay,
                ease: "easeOut",
                ...transition,
              }}
              {...props}
            />
          );
        })}
    </AnimatePresence>
  );
}

export { Particles, ParticlesEffect, type ParticlesProps, type ParticlesEffectProps };
