"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { MovieCard } from "@/components/ui/movie-card";
import { MatchAlert } from "@/components/ui/match-alert";
import { MovieRoulette } from "@/components/ui/movie-roulette";
import { getPosterUrl } from "@/lib/tmdb";
import type { TMDBMovie } from "@/lib/tmdb";
import type { Match, SwipeDirection } from "@/types";
import { Loader2, Sparkles } from "lucide-react";

interface PoolMovie {
  movie_id: number;
  movie_title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string | null;
  vote_average: number | null;
  overview: string | null;
}

export default function RoomSwipePage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;
  const [movies, setMovies] = useState<TMDBMovie[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newMatch, setNewMatch] = useState<Match | null>(null);
  const [votedMovieIds, setVotedMovieIds] = useState<Set<number>>(new Set());
  const [allMatches, setAllMatches] = useState<Match[]>([]);
  const [showRoulette, setShowRoulette] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  // Fetch room and determine phase
  useEffect(() => {
    async function fetchRoom() {
      const { data, error: roomError } = await supabase
        .from("rooms")
        .select("id, status")
        .eq("code", code)
        .single();

      if (roomError || !data) {
        setError("No se pudo acceder a la sala");
        setLoading(false);
        return;
      }

      // If room is still in lobby, redirect to lobby page
      if (data.status === "lobby") {
        router.replace(`/room/${code}/lobby`);
        return;
      }

      setRoomId(data.id);

      // Fetch already-voted movie IDs to filter them out
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: votes } = await supabase
          .from("movie_votes")
          .select("movie_id")
          .eq("room_id", data.id)
          .eq("user_id", user.id);

        if (votes) {
          setVotedMovieIds(new Set(votes.map((v) => v.movie_id)));
        }
      }
    }
    fetchRoom();
  }, [code, supabase, router]);

  // Fetch movies from the room's pool (not trending)
  const fetchPoolMovies = useCallback(
    async (roomIdParam: string) => {
      try {
        const res = await fetch(
          `/api/rooms/movies?roomId=${roomIdParam}`,
        );
        if (!res.ok) throw new Error("Failed to fetch pool");
        const data = await res.json();

        if (data.movies) {
          // Deduplicate by movie_id (both users may have added the same movie)
          const seen = new Set<number>();
          const uniqueMovies: TMDBMovie[] = [];

          for (const m of data.movies as PoolMovie[]) {
            if (!seen.has(m.movie_id) && !votedMovieIds.has(m.movie_id)) {
              seen.add(m.movie_id);
              uniqueMovies.push({
                id: m.movie_id,
                title: m.movie_title,
                poster_path: m.poster_path,
                backdrop_path: m.backdrop_path,
                release_date: m.release_date || "",
                vote_average: m.vote_average ? Number(m.vote_average) : 0,
                vote_count: 0,
                genre_ids: [],
                overview: m.overview || "",
              });
            }
          }

          // Shuffle the movies for a better experience
          for (let i = uniqueMovies.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [uniqueMovies[i], uniqueMovies[j]] = [
              uniqueMovies[j],
              uniqueMovies[i],
            ];
          }

          setMovies(uniqueMovies);
        }
      } catch (_err) {
        console.error("Failed to fetch pool movies");
        setError("Error al cargar películas");
      } finally {
        setLoading(false);
      }
    },
    [votedMovieIds],
  );

  useEffect(() => {
    if (roomId) {
      fetchPoolMovies(roomId);
    }
  }, [roomId, fetchPoolMovies]);

  // Subscribe to matches in real-time
  useEffect(() => {
    if (!roomId) return;

    // Fetch existing matches
    async function fetchMatches() {
      const { data } = await supabase
        .from("matches")
        .select("*")
        .eq("room_id", roomId);

      if (data) {
        setAllMatches(
          data.map((m) => ({
            id: m.id,
            roomId: m.room_id,
            movieId: m.movie_id,
            movieTitle: m.movie_title,
            posterPath: m.poster_path,
            matchedAt: m.matched_at,
          })),
        );
      }
    }
    fetchMatches();

    const channel = supabase
      .channel(`matches:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "matches",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const m = payload.new;
          const match: Match = {
            id: m.id,
            roomId: m.room_id,
            movieId: m.movie_id,
            movieTitle: m.movie_title,
            posterPath: m.poster_path,
            matchedAt: m.matched_at,
          };
          setNewMatch(match);
          setAllMatches((prev) => {
            if (prev.some((existing) => existing.id === match.id)) return prev;
            return [...prev, match];
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, supabase]);

  // Called by MovieCard AFTER its exit animation completes
  async function handleSwipe(direction: SwipeDirection) {
    const movie = movies[currentIndex];
    if (!movie || !roomId) return;

    // Advance to next card
    setCurrentIndex((prev) => prev + 1);

    // Track as voted
    setVotedMovieIds((prev) => new Set(prev).add(movie.id));

    const vote = direction === "right" ? "like" : "dislike";

    try {
      const res = await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId,
          movieId: movie.id,
          movieTitle: movie.title,
          posterPath: movie.poster_path,
          backdropPath: movie.backdrop_path,
          vote,
        }),
      });

      const data = await res.json();

      if (data.match) {
        setNewMatch({
          id: "",
          roomId,
          movieId: movie.id,
          movieTitle: movie.title,
          posterPath: movie.poster_path,
          matchedAt: new Date().toISOString(),
        });
      }
    } catch (_err) {
      console.error("Vote failed");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <p className="text-danger text-sm">{error}</p>
      </div>
    );
  }

  const currentMovie = movies[currentIndex];
  const nextMovie = movies[currentIndex + 1];

  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] px-4">
      {currentMovie ? (
        <div className="relative">
          {/* Next card peeking underneath */}
          {nextMovie && (
            <div className="absolute inset-x-0 top-0 w-full max-w-sm mx-auto scale-[0.95] opacity-40 -z-10">
              <div className="rounded-2xl overflow-hidden border border-primary/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getPosterUrl(nextMovie.poster_path, "w500")}
                  alt=""
                  className="w-full aspect-[2/3] object-cover"
                  draggable={false}
                />
                <div className="absolute inset-0 bg-black/40" />
              </div>
            </div>
          )}

          {/* Current card — key forces fresh instance per movie */}
          <MovieCard
            key={currentMovie.id}
            movie={currentMovie}
            onSwipe={handleSwipe}
          />
        </div>
      ) : (
        <div className="text-center">
          <p className="text-text-muted">
            {movies.length === 0
              ? "No hay películas en el pool de esta sala."
              : "Ya votaste por todas las películas del pool."}
          </p>
          <p className="text-text-muted text-sm mt-2">
            ¡Revisa tus matches para ver las coincidencias!
          </p>
          {allMatches.length > 1 && (
            <button
              onClick={() => setShowRoulette(true)}
              className="btn-primary mt-4 inline-flex items-center gap-2"
            >
              <Sparkles className="w-5 h-5" />
              Girar la ruleta
            </button>
          )}
        </div>
      )}

      {newMatch && (
        <MatchAlert match={newMatch} onClose={() => setNewMatch(null)} />
      )}

      {showRoulette && allMatches.length > 1 && (
        <MovieRoulette
          matches={allMatches}
          onClose={() => setShowRoulette(false)}
        />
      )}
    </div>
  );
}
