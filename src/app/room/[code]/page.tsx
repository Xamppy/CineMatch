"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
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
  const [newMatch, setNewMatch] = useState<Match | null>(null);
  const [page, setPage] = useState(1);

  const supabase = createClient();

  // Fetch room ID from code
  useEffect(() => {
    async function fetchRoom() {
      const { data } = await supabase
        .from("rooms")
        .select("id")
        .eq("code", code)
        .single();
      if (data) setRoomId(data.id);
    }
    fetchRoom();
  }, [code, supabase]);

  // Fetch trending movies
  const fetchMovies = useCallback(async (pageNum: number) => {
    try {
      const res = await fetch(`/api/movies/trending?page=${pageNum}`);
      const data = await res.json();
      if (data.results) {
        setMovies((prev) => [...prev, ...data.results]);
      }
    } catch (error) {
      console.error("Failed to fetch movies:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMovies(page);
  }, [page, fetchMovies]);

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
          setNewMatch(payload.new as Match);
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
    } catch (error) {
      console.error("Vote failed:", error);
    }

    // Move to next card
    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);

    // Load more when running low
    if (nextIndex >= movies.length - 3) {
      setPage((p) => p + 1);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
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
