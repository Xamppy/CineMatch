"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getPosterUrl } from "@/lib/tmdb";
import { Heart, Loader2 } from "lucide-react";
import type { Match } from "@/types";

export default function MatchesPage() {
  const params = useParams();
  const code = params.code as string;
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);

  // Fetch matches and subscribe to realtime
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function init() {
      const { data: room, error: roomError } = await supabase
        .from("rooms")
        .select("id")
        .eq("code", code)
        .single();

      if (roomError || !room) {
        setError("No se pudo acceder a la sala");
        setLoading(false);
        return;
      }

      const { data, error: matchesError } = await supabase
        .from("matches")
        .select("*")
        .eq("room_id", room.id)
        .order("matched_at", { ascending: false });

      if (matchesError) {
        console.error("Matches fetch error:", matchesError);
        setError("Error al cargar los matches");
      } else if (data) {
        setMatches(
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
      setLoading(false);

      // Subscribe to new matches
      channel = supabase
        .channel(`matches-list:${room.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "matches",
            filter: `room_id=eq.${room.id}`,
          },
          (payload) => {
            const m = payload.new;
            setMatches((prev) => {
              // Avoid duplicates
              if (prev.some((existing) => existing.id === m.id)) return prev;
              return [
                {
                  id: m.id,
                  roomId: m.room_id,
                  movieId: m.movie_id,
                  movieTitle: m.movie_title,
                  posterPath: m.poster_path,
                  matchedAt: m.matched_at,
                },
                ...prev,
              ];
            });
          },
        )
        .subscribe();
    }

    init();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [code, supabase]);

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

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <Heart className="w-6 h-6 text-secondary" />
        Matches ({matches.length})
      </h2>

      {matches.length === 0 ? (
        <div className="text-center py-12">
          <Heart className="w-12 h-12 text-text-muted mx-auto mb-3 opacity-30" />
          <p className="text-text-muted">Aún no hay matches</p>
          <p className="text-text-muted text-sm mt-1">
            ¡Sigan deslizando para encontrar películas en común!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {matches.map((match) => (
            <div key={match.id} className="card p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getPosterUrl(match.posterPath, "w342")}
                alt={match.movieTitle}
                className="w-full aspect-[2/3] rounded-xl object-cover bg-surface-light mb-2"
              />
              <h3 className="font-semibold text-sm text-text-primary truncate">
                {match.movieTitle}
              </h3>
              <div className="flex items-center gap-1 mt-1">
                <Heart className="w-3 h-3 text-secondary fill-secondary" />
                <span className="text-xs text-text-muted">Match</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
