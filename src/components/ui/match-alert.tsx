"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Heart, X } from "lucide-react";
import { getPosterUrl } from "@/lib/tmdb";
import type { Match } from "@/types";

interface MatchAlertProps {
  match: Match;
  onClose: () => void;
}

export function MatchAlert({ match, onClose }: MatchAlertProps) {
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="relative text-center px-8 py-10 max-w-sm mx-4"
          initial={{ scale: 0.5, opacity: 0, y: 50 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.5, opacity: 0, y: 50 }}
          transition={{ type: "spring", damping: 15, stiffness: 200 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Hearts animation */}
          <motion.div
            className="flex justify-center mb-4"
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.3, 1] }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <div className="relative">
              <Heart className="w-20 h-20 text-secondary fill-secondary" />
              <motion.div
                className="absolute inset-0 flex items-center justify-center"
                animate={{
                  scale: [1, 1.2, 1],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 1.5,
                  ease: "easeInOut",
                }}
              >
                <Heart className="w-20 h-20 text-secondary/30 fill-secondary/30" />
              </motion.div>
            </div>
          </motion.div>

          <motion.h2
            className="text-4xl font-bold bg-gradient-to-r from-primary-light to-secondary-light bg-clip-text text-transparent mb-4"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            Match!
          </motion.h2>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getPosterUrl(match.posterPath, "w342")}
              alt={match.movieTitle}
              className="w-40 h-60 rounded-xl object-cover mx-auto mb-4 shadow-lg border border-primary/20"
            />
            <p className="text-lg font-semibold text-text-primary mb-1">
              {match.movieTitle}
            </p>
            <p className="text-text-muted text-sm">
              A ambos les gustó esta película
            </p>
          </motion.div>

          <motion.button
            onClick={onClose}
            className="mt-6 btn-primary"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <span className="flex items-center justify-center gap-2">
              <X className="w-5 h-5" />
              Seguir deslizando
            </span>
          </motion.button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
