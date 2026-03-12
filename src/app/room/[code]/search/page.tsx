"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { Search, Plus, Check, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getPosterUrl } from "@/lib/tmdb";
import type { TMDBMovie } from "@/lib/tmdb";

export default function SearchPage() {
  const params = useParams();
  const code = params.code as string;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TMDBMovie[]>([]);
  const [loading, setLoading] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addedMovies, setAddedMovies] = useState<Set<number>>(new Set());
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    async function fetchRoom() {
      const { data, error: roomError } = await supabase
        .from("rooms")
        .select("id")
        .eq("code", code)
        .single();

      if (roomError || !data) {
        setError("No se pudo acceder a la sala");
        return;
      }

      setRoomId(data.id);
    }
    fetchRoom();
  }, [code, supabase]);

  const searchMovies = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `/api/movies/search?q=${encodeURIComponent(q)}`,
      );
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setResults(data.results || []);
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleInputChange(value: string) {
    setQuery(value);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      searchMovies(value);
    }, 300);
  }

  async function handleAddMovie(movie: TMDBMovie) {
    if (!roomId) return;

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
          vote: "like",
        }),
      });

      if (res.ok) {
        setAddedMovies((prev) => new Set(prev).add(movie.id));
      }
    } catch (err) {
      console.error("Add movie failed:", err);
    }
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <p className="text-danger text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Search Input */}
      <div className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
          <input
            type="text"
            placeholder="Buscar películas..."
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            className="input-field pl-11"
            autoFocus
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-accent animate-spin" />
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
        {results.map((movie) => {
          const isAdded = addedMovies.has(movie.id);

          return (
            <div
              key={movie.id}
              className="flex items-center gap-3 p-3 rounded-xl bg-surface border border-primary/10 hover:border-primary/20 transition-colors"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getPosterUrl(movie.poster_path, "w185")}
                alt={movie.title}
                className="w-16 h-24 rounded-lg object-cover bg-surface-light"
              />

              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-text-primary truncate">
                  {movie.title}
                </h3>
                <p className="text-sm text-text-muted">
                  {movie.release_date?.split("-")[0] || "N/A"}
                </p>
                <p className="text-sm text-text-secondary">
                  {movie.vote_average?.toFixed(1)} / 10
                </p>
              </div>

              <button
                onClick={() => handleAddMovie(movie)}
                disabled={isAdded}
                className={`p-2 rounded-full transition-colors ${
                  isAdded
                    ? "bg-success/20 text-success"
                    : "bg-primary/20 text-accent hover:bg-primary/30"
                }`}
              >
                {isAdded ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <Plus className="w-5 h-5" />
                )}
              </button>
            </div>
          );
        })}

        {query.length >= 2 && !loading && results.length === 0 && (
          <p className="text-center text-text-muted py-8">
            No se encontraron películas
          </p>
        )}

        {query.length < 2 && (
          <p className="text-center text-text-muted py-8">
            Escribe al menos 2 caracteres para buscar
          </p>
        )}
      </div>
    </div>
  );
}
