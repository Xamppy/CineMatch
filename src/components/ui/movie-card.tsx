"use client";

import { motion, useMotionValue, useTransform } from "framer-motion";
import { Star } from "lucide-react";
import { getPosterUrl } from "@/lib/tmdb";
import type { TMDBMovie } from "@/lib/tmdb";
import type { SwipeDirection } from "@/types";

interface MovieCardProps {
  movie: TMDBMovie;
  onSwipe: (direction: SwipeDirection) => void;
  exitDirection?: SwipeDirection | null;
  isSwiping?: boolean;
}

const EXIT_X = 400;

const variants = {
  enter: {
    x: 0,
    opacity: 1,
    scale: 1,
    rotate: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 30 },
  },
  idle: {
    x: 0,
    opacity: 1,
    scale: 1,
    rotate: 0,
  },
  exitRight: {
    x: EXIT_X,
    opacity: 0,
    rotate: 15,
    transition: { duration: 0.3, ease: "easeIn" as const },
  },
  exitLeft: {
    x: -EXIT_X,
    opacity: 0,
    rotate: -15,
    transition: { duration: 0.3, ease: "easeIn" as const },
  },
};

export function MovieCard({
  movie,
  onSwipe,
  exitDirection,
  isSwiping,
}: MovieCardProps) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 0, 200], [-15, 0, 15]);
  const likeOpacity = useTransform(x, [0, 100], [0, 1]);
  const nopeOpacity = useTransform(x, [-100, 0], [1, 0]);

  function handleDragEnd(
    _: unknown,
    info: { offset: { x: number }; velocity: { x: number } },
  ) {
    // If already swiping (animation in progress), ignore
    if (isSwiping) return;

    const threshold = 100;
    const velocity = info.velocity.x;
    const offset = info.offset.x;

    if (offset > threshold || velocity > 500) {
      onSwipe("right");
    } else if (offset < -threshold || velocity < -500) {
      onSwipe("left");
    }
  }

  // Determine the exit variant based on exitDirection
  const exitVariant = exitDirection === "right" ? "exitRight" : "exitLeft";

  return (
    <motion.div
      className="absolute inset-0"
      initial="enter"
      animate="idle"
      exit={exitVariant}
      variants={variants}
      style={{ x, rotate }}
      drag={isSwiping ? false : "x"}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onDragEnd={handleDragEnd}
      whileTap={isSwiping ? undefined : { scale: 1.02 }}
    >
      {/* Card */}
      <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-primary/10 cursor-grab active:cursor-grabbing">
        {/* Poster */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={getPosterUrl(movie.poster_path, "w500")}
          alt={movie.title}
          className="w-full aspect-[2/3] object-cover"
          draggable={false}
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

        {/* LIKE stamp */}
        <motion.div
          className="absolute top-6 left-6 border-4 border-success text-success font-bold text-3xl px-4 py-1 rounded-lg -rotate-12"
          style={{ opacity: likeOpacity }}
        >
          LIKE
        </motion.div>

        {/* NOPE stamp */}
        <motion.div
          className="absolute top-6 right-6 border-4 border-danger text-danger font-bold text-3xl px-4 py-1 rounded-lg rotate-12"
          style={{ opacity: nopeOpacity }}
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
  );
}
