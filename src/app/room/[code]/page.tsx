"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { MovieCard } from "@/components/ui/movie-card";
import { MatchAlert } from "@/components/ui/match-alert";
import type { TMDBMovie } from "@/lib/tmdb";
import type { Match } from "@/types";
import { Loader2 } from "lucide-react";

export default function RoomSwipePage() {
  const params = useParams();
  const code = params.code as string;
  const [movies, setMovies] = useState<TMDBMovie[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newMatch, setNewMatch] = useState<Match | null>(null);
  const [page, setPage] = useState(1);
  const [votedMovieIds, setVotedMovieIds] = useState<Set<number>>(new Set());

  const supabase = useMemo(() => createClient(), []);

  // Fetch room ID from code and get already-voted movies
  useEffect(() => {
    async function fetchRoom() {
      const { data, error: roomError } = await supabase
        .from("rooms")
        .select("id")
        .eq("code", code)
        .single();

      if (roomError || !data) {
        setError("No se pudo acceder a la sala");
        setLoading(false);
        return;
      }

      setRoomId(data.id);

      // Fetch already-voted movie IDs to filter them out
      const { data: votes } = await supabase
        .from("movie_votes")
        .select("movie_id")
        .eq("room_id", data.id);

      if (votes) {
        setVotedMovieIds(new Set(votes.map((v) => v.movie_id)));
      }
    }
    fetchRoom();
  }, [code, supabase]);

  // Fetch trending movies, filtering out already-voted ones
  const fetchMovies = useCallback(
    async (pageNum: number) => {
      try {
        const res = await fetch(`/api/movies/trending?page=${pageNum}`);
        if (!res.ok) throw new Error("Failed to fetch movies");
        const data = await res.json();
        if (data.results) {
          setMovies((prev) => {
            const newMovies = (data.results as TMDBMovie[]).filter(
              (m) => !votedMovieIds.has(m.id),
            );
            return [...prev, ...newMovies];
          });
        }
      } catch (err) {
        console.error("Failed to fetch movies:", err);
        setError("Error al cargar películas");
      } finally {
        setLoading(false);
      }
    },
    [votedMovieIds],
  );

  useEffect(() => {
    if (roomId) {
      fetchMovies(page);
    }
  }, [page, roomId, fetchMovies]);

  // Subscribe to matches in real-time
  useEffect(() => {
    if (!roomId) return;

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
          setNewMatch({
            id: m.id,
            roomId: m.room_id,
            movieId: m.movie_id,
            movieTitle: m.movie_title,
            posterPath: m.poster_path,
            matchedAt: m.matched_at,
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, supabase]);

  async function handleSwipe(direction: "left" | "right") {
    const movie = movies[currentIndex];
    if (!movie || !roomId) return;

    const vote = direction === "right" ? "like" : "dislike";

    // Move to next card immediately for snappy UX
    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);

    // Load more when running low
    if (nextIndex >= movies.length - 3) {
      setPage((p) => p + 1);
    }

    // Track as voted
    setVotedMovieIds((prev) => new Set(prev).add(movie.id));

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
    } catch (err) {
      console.error("Vote failed:", err);
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

  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] px-4">
      {currentMovie ? (
        <MovieCard movie={currentMovie} onSwipe={handleSwipe} />
      ) : (
        <div className="text-center">
          <p className="text-text-muted">No hay más películas por ahora.</p>
          <p className="text-text-muted text-sm mt-2">
            ¡Intenta buscar películas específicas!
          </p>
        </div>
      )}

      {newMatch && (
        <MatchAlert match={newMatch} onClose={() => setNewMatch(null)} />
      )}
    </div>
  );
}
