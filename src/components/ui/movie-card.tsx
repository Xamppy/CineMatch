"use client";

import { useRef, useState } from "react";
import {
  motion,
  useMotionValue,
  useTransform,
  animate,
} from "framer-motion";
import { Heart, Star, X } from "lucide-react";
import { getPosterUrl } from "@/lib/tmdb";
import type { TMDBMovie } from "@/lib/tmdb";
import type { SwipeDirection } from "@/types";

interface MovieCardProps {
  movie: TMDBMovie;
  onSwipe: (direction: SwipeDirection) => void;
}

const EXIT_X = 400;
const SWIPE_THRESHOLD = 100;
const VELOCITY_THRESHOLD = 500;

export function MovieCard({ movie, onSwipe }: MovieCardProps) {
  const exitingRef = useRef(false);
  const [exiting, setExiting] = useState(false);
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 0, 200], [-15, 0, 15]);
  const opacity = useTransform(
    x,
    [-EXIT_X, -200, 0, 200, EXIT_X],
    [0, 1, 1, 1, 0],
  );
  const likeOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
  const nopeOpacity = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0]);

  async function triggerSwipe(direction: SwipeDirection) {
    if (exitingRef.current) return;
    exitingRef.current = true;
    setExiting(true);

    const targetX = direction === "right" ? EXIT_X : -EXIT_X;
    await animate(x, targetX, { duration: 0.25, ease: "easeIn" });
    onSwipe(direction);
  }

  function handleDragEnd(
    _: unknown,
    info: { offset: { x: number }; velocity: { x: number } },
  ) {
    if (exitingRef.current) return;

    const velocity = info.velocity.x;
    const offset = info.offset.x;

    if (offset > SWIPE_THRESHOLD || velocity > VELOCITY_THRESHOLD) {
      triggerSwipe("right");
    } else if (
      offset < -SWIPE_THRESHOLD ||
      velocity < -VELOCITY_THRESHOLD
    ) {
      triggerSwipe("left");
    }
  }

  return (
    <div
      className="relative w-full max-w-sm mx-auto"
      role="group"
      aria-label={`Pelicula: ${movie.title}`}
    >
      {/* Draggable card */}
      <motion.div
        className="relative cursor-grab active:cursor-grabbing select-none"
        style={{ x, rotate, opacity, touchAction: "pan-y" }}
        drag={exiting ? false : "x"}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.9}
        onDragEnd={handleDragEnd}
        whileTap={exiting ? undefined : { scale: 1.02 }}
      >
        <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-primary/10">
          {/* Poster */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={getPosterUrl(movie.poster_path, "w500")}
            alt={`Poster de ${movie.title}`}
            className="w-full aspect-[2/3] object-cover"
            draggable={false}
          />

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

          {/* LIKE stamp */}
          <motion.div
            className="absolute top-6 left-6 border-4 border-success text-success font-bold text-3xl px-4 py-1 rounded-lg -rotate-12 pointer-events-none"
            style={{ opacity: likeOpacity }}
            aria-hidden="true"
          >
            LIKE
          </motion.div>

          {/* NOPE stamp */}
          <motion.div
            className="absolute top-6 right-6 border-4 border-danger text-danger font-bold text-3xl px-4 py-1 rounded-lg rotate-12 pointer-events-none"
            style={{ opacity: nopeOpacity }}
            aria-hidden="true"
          >
            NOPE
          </motion.div>

          {/* Info */}
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <h2 className="text-2xl font-bold text-white mb-1">
              {movie.title}
            </h2>
            <div className="flex items-center gap-3 text-white/80">
              <span>{movie.release_date?.split("-")[0]}</span>
              <span className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                {movie.vote_average?.toFixed(1)}
              </span>
            </div>
            {movie.overview && (
              <p className="text-white/60 text-sm mt-2 line-clamp-2">
                {movie.overview}
              </p>
            )}
          </div>
        </div>
      </motion.div>

      {/* Action Buttons — min 48x48 for touch targets */}
      <div className="flex justify-center gap-8 mt-6">
        <button
          onClick={() => triggerSwipe("left")}
          disabled={exiting}
          aria-label={`Rechazar ${movie.title}`}
          className="w-16 h-16 rounded-full bg-surface border-2 border-danger/30 flex items-center justify-center hover:bg-danger/10 hover:border-danger/60 transition-all duration-150 active:scale-90 disabled:opacity-40 disabled:pointer-events-none"
        >
          <X className="w-8 h-8 text-danger" />
        </button>
        <button
          onClick={() => triggerSwipe("right")}
          disabled={exiting}
          aria-label={`Me gusta ${movie.title}`}
          className="w-16 h-16 rounded-full bg-surface border-2 border-success/30 flex items-center justify-center hover:bg-success/10 hover:border-success/60 transition-all duration-150 active:scale-90 disabled:opacity-40 disabled:pointer-events-none"
        >
          <Heart className="w-8 h-8 text-success" />
        </button>
      </div>
    </div>
  );
}
