"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { Sparkles, Trophy, X, RotateCcw } from "lucide-react";
import { getPosterUrl } from "@/lib/tmdb";
import type { Match } from "@/types";

interface MovieRouletteProps {
  matches: Match[];
  onClose: () => void;
}

const ITEM_HEIGHT = 180;
const VISIBLE_ITEMS = 3;
const SPIN_DURATION = 4.5;

export function MovieRoulette({ matches, onClose }: MovieRouletteProps) {
  const [phase, setPhase] = useState<"idle" | "spinning" | "landed">("idle");
  const [winner, setWinner] = useState<Match | null>(null);
  const controls = useAnimation();
  const stripRef = useRef<HTMLDivElement>(null);

  // Build a long strip: repeat matches enough times for a long spin
  const repeatCount = Math.max(12, Math.ceil(60 / matches.length));
  const strip = Array.from(
    { length: repeatCount },
    () => matches,
  ).flat();

  // Pick a random winner index in the last "cycle" so the spin
  // travels a long distance before landing
  const pickWinnerIndex = useCallback(() => {
    const lastCycleStart = (repeatCount - 2) * matches.length;
    const offset = Math.floor(Math.random() * matches.length);
    return lastCycleStart + offset;
  }, [matches.length, repeatCount]);

  const handleSpin = useCallback(async () => {
    if (phase === "spinning") return;

    setPhase("spinning");
    setWinner(null);

    const targetIndex = pickWinnerIndex();
    const targetMatch = strip[targetIndex];

    // Calculate Y offset to center the winner in the viewport
    const centerOffset = Math.floor(VISIBLE_ITEMS / 2) * ITEM_HEIGHT;
    const targetY = -(targetIndex * ITEM_HEIGHT) + centerOffset;

    // Reset to top
    await controls.set({ y: 0 });

    // Animate with a custom easing that simulates deceleration
    await controls.start({
      y: targetY,
      transition: {
        duration: SPIN_DURATION,
        ease: [0.15, 0.85, 0.25, 1],
      },
    });

    setWinner(targetMatch);
    setPhase("landed");
  }, [phase, pickWinnerIndex, strip, controls]);

  const handleReset = useCallback(() => {
    setPhase("idle");
    setWinner(null);
    controls.set({ y: 0 });
  }, [controls]);

  // Keyboard support
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (phase === "idle") handleSpin();
        else if (phase === "landed") handleReset();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [phase, handleSpin, handleReset, onClose]);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/70 backdrop-blur-md"
          onClick={onClose}
        />

        {/* Content */}
        <motion.div
          className="relative z-10 flex flex-col items-center gap-6 px-4 max-w-md w-full"
          initial={{ scale: 0.8, opacity: 0, y: 40 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: 40 }}
          transition={{ type: "spring", damping: 20, stiffness: 250 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute -top-2 -right-2 p-2 rounded-full
                       bg-surface-light/80 border border-primary/20
                       text-text-muted hover:text-text-primary
                       transition-colors z-20"
            aria-label="Cerrar ruleta"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Title */}
          <motion.div
            className="text-center"
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <h2 className="text-2xl font-bold roulette-title-gradient">
              <Sparkles className="w-6 h-6 inline-block mr-2 text-accent" />
              Ruleta de Matches
            </h2>
            <p className="text-text-muted text-sm mt-1">
              {matches.length} películas coinciden
              {phase === "idle" && " - gira para elegir"}
            </p>
          </motion.div>

          {/* Roulette wheel container */}
          <div className="relative w-full">
            {/* The viewport with mask edges */}
            <div
              className="relative mx-auto overflow-hidden rounded-2xl
                         border border-primary/20 roulette-viewport"
              style={{ height: ITEM_HEIGHT * VISIBLE_ITEMS }}
            >
              {/* Gradient masks for top and bottom fade */}
              <div
                className="absolute inset-x-0 top-0 h-16 z-10
                           pointer-events-none roulette-mask-top"
              />
              <div
                className="absolute inset-x-0 bottom-0 h-16 z-10
                           pointer-events-none roulette-mask-bottom"
              />

              {/* Center selection indicator */}
              <div
                className="absolute inset-x-0 z-10 pointer-events-none
                           border-y-2 roulette-indicator"
                style={{
                  top: ITEM_HEIGHT,
                  height: ITEM_HEIGHT,
                }}
              />

              {/* Scrolling strip */}
              <motion.div ref={stripRef} animate={controls}>
                {strip.map((match, i) => {
                  const isWinner =
                    phase === "landed" && winner?.id === match.id;
                  return (
                    <div
                      key={`${match.id}-${i}`}
                      className="flex items-center gap-4 px-4"
                      style={{ height: ITEM_HEIGHT }}
                    >
                      {/* Poster */}
                      <div
                        className={`
                          relative shrink-0 rounded-xl overflow-hidden
                          transition-all duration-300
                          ${isWinner ? "roulette-winner-poster" : ""}
                        `}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={getPosterUrl(match.posterPath, "w185")}
                          alt={match.movieTitle}
                          className="w-24 h-36 object-cover rounded-xl"
                          draggable={false}
                        />
                      </div>

                      {/* Movie info */}
                      <div className="flex-1 min-w-0">
                        <p
                          className={`
                            font-semibold text-sm leading-tight truncate
                            ${isWinner ? "text-accent" : "text-text-primary"}
                          `}
                        >
                          {match.movieTitle}
                        </p>
                        <p className="text-text-muted text-xs mt-1">
                          Match
                        </p>
                      </div>
                    </div>
                  );
                })}
              </motion.div>
            </div>

            {/* Side glow lines */}
            <div
              className="absolute left-0 top-0 bottom-0 w-px
                         roulette-side-glow"
            />
            <div
              className="absolute right-0 top-0 bottom-0 w-px
                         roulette-side-glow"
            />
          </div>

          {/* Winner reveal */}
          <AnimatePresence>
            {phase === "landed" && winner && (
              <motion.div
                className="text-center"
                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.9 }}
                transition={{ type: "spring", damping: 18, stiffness: 200 }}
              >
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Trophy className="w-5 h-5 text-yellow-400" />
                  <span
                    className="text-lg font-bold
                               bg-gradient-to-r from-yellow-300 to-amber-400
                               bg-clip-text text-transparent"
                  >
                    {winner.movieTitle}
                  </span>
                  <Trophy className="w-5 h-5 text-yellow-400" />
                </div>
                <p className="text-text-muted text-xs">
                  Esta es la elegida para esta noche
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action buttons */}
          <div className="flex gap-3 w-full">
            {phase === "idle" && (
              <motion.button
                className="btn-primary flex-1 flex items-center justify-center gap-2"
                onClick={handleSpin}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                <Sparkles className="w-5 h-5" />
                Girar
              </motion.button>
            )}

            {phase === "spinning" && (
              <div
                className="flex-1 flex items-center justify-center gap-2
                           text-accent py-3"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{
                    repeat: Infinity,
                    duration: 1,
                    ease: "linear",
                  }}
                >
                  <Sparkles className="w-5 h-5" />
                </motion.div>
                <span className="font-semibold text-sm">Girando...</span>
              </div>
            )}

            {phase === "landed" && (
              <motion.button
                className="btn-secondary flex-1 flex items-center justify-center gap-2"
                onClick={handleReset}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                <RotateCcw className="w-4 h-4" />
                Girar otra vez
              </motion.button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
