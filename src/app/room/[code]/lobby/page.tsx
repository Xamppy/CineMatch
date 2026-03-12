"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Search,
  Plus,
  Check,
  Loader2,
  X,
  Star,
  Film,
  ChevronDown,
  Users,
  Sparkles,
  TrendingUp,
  Award,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { getPosterUrl } from "@/lib/tmdb";
import type { TMDBMovie } from "@/lib/tmdb";

const MIN_MOVIES = 5;

interface RoomMovieData {
  id: string;
  room_id: string;
  user_id: string;
  movie_id: number;
  movie_title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string | null;
  vote_average: number | null;
  overview: string | null;
  added_at: string;
}

interface MemberStatus {
  userId: string;
  isReady: boolean;
}

type RecommendCategory = "popular" | "top_rated" | "trending";

export default function LobbyPage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  // Core state
  const [roomId, setRoomId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search state
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<TMDBMovie[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Recommendations state
  const [recommendations, setRecommendations] = useState<TMDBMovie[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);
  const [recsCategory, setRecsCategory] =
    useState<RecommendCategory>("popular");
  const [recsPage, setRecsPage] = useState(1);

  // Room movies state
  const [myMovies, setMyMovies] = useState<RoomMovieData[]>([]);
  const [addedMovieIds, setAddedMovieIds] = useState<Set<number>>(new Set());
  const [addingMovieId, setAddingMovieId] = useState<number | null>(null);

  // Ready state
  const [isReady, setIsReady] = useState(false);
  const [members, setMembers] = useState<MemberStatus[]>([]);
  const [readyLoading, setReadyLoading] = useState(false);

  // UI state
  const [showMyList, setShowMyList] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  // Initialize: fetch room, user, and existing movies
  useEffect(() => {
    async function init() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setError("No autorizado");
          setLoading(false);
          return;
        }
        setUserId(user.id);

        const { data: room, error: roomError } = await supabase
          .from("rooms")
          .select("id, status")
          .eq("code", code)
          .single();

        if (roomError || !room) {
          setError("No se pudo acceder a la sala");
          setLoading(false);
          return;
        }

        // If room is already in swiping phase, redirect
        if (room.status === "swiping" || room.status === "completed") {
          router.replace(`/room/${code}`);
          return;
        }

        setRoomId(room.id);

        // Fetch existing room movies for this user
        const { data: existingMovies } = await supabase
          .from("room_movies")
          .select("*")
          .eq("room_id", room.id)
          .eq("user_id", user.id)
          .order("added_at", { ascending: true });

        if (existingMovies) {
          setMyMovies(existingMovies);
          setAddedMovieIds(new Set(existingMovies.map((m) => m.movie_id)));
        }

        // Fetch member statuses
        const { data: memberData } = await supabase
          .from("room_members")
          .select("user_id, is_ready")
          .eq("room_id", room.id);

        if (memberData) {
          setMembers(
            memberData.map((m) => ({
              userId: m.user_id,
              isReady: m.is_ready,
            })),
          );
          const myMembership = memberData.find(
            (m) => m.user_id === user.id,
          );
          if (myMembership) {
            setIsReady(myMembership.is_ready);
          }
        }
      } catch (_err) {
        setError("Error al inicializar");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [code, supabase, router]);

  // Subscribe to realtime changes on room_members (ready status)
  // and room_movies (see when partner adds movies) and rooms (status change)
  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`lobby:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "room_members",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const updated = payload.new;
          setMembers((prev) =>
            prev.map((m) =>
              m.userId === updated.user_id
                ? { ...m, isReady: updated.is_ready }
                : m,
            ),
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "room_members",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const newMember = payload.new;
          setMembers((prev) => {
            if (prev.some((m) => m.userId === newMember.user_id)) return prev;
            return [
              ...prev,
              { userId: newMember.user_id, isReady: newMember.is_ready },
            ];
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          const updated = payload.new;
          if (
            updated.status === "swiping" ||
            updated.status === "completed"
          ) {
            router.replace(`/room/${code}`);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, supabase, code, router]);

  // Fetch recommendations
  const fetchRecommendations = useCallback(
    async (category: RecommendCategory, page: number) => {
      setRecsLoading(true);
      try {
        const endpoint =
          category === "trending"
            ? `/api/movies/trending?page=${page}`
            : `/api/movies/popular?category=${category}&page=${page}`;
        const res = await fetch(endpoint);
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        if (data.results) {
          if (page === 1) {
            setRecommendations(data.results);
          } else {
            setRecommendations((prev) => [...prev, ...data.results]);
          }
        }
      } catch (_err) {
        console.error("Failed to fetch recommendations");
      } finally {
        setRecsLoading(false);
      }
    },
    [],
  );

  // Load recommendations on category change
  useEffect(() => {
    if (roomId) {
      setRecsPage(1);
      fetchRecommendations(recsCategory, 1);
    }
  }, [recsCategory, roomId, fetchRecommendations]);

  // Search movies
  const searchMovies = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await fetch(
        `/api/movies/search?q=${encodeURIComponent(q)}`,
      );
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch (_err) {
      console.error("Search failed");
    } finally {
      setSearchLoading(false);
    }
  }, []);

  function handleSearchInput(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchMovies(value), 300);
  }

  // Add movie to room pool
  async function handleAddMovie(movie: TMDBMovie) {
    if (!roomId || addedMovieIds.has(movie.id)) return;

    setAddingMovieId(movie.id);
    try {
      const res = await fetch("/api/rooms/movies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId,
          movieId: movie.id,
          movieTitle: movie.title,
          posterPath: movie.poster_path,
          backdropPath: movie.backdrop_path,
          releaseDate: movie.release_date,
          voteAverage: movie.vote_average,
          overview: movie.overview,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setAddedMovieIds((prev) => new Set(prev).add(movie.id));
        setMyMovies((prev) => [...prev, data.movie]);
        // If user was ready and adds another movie, that's fine
      } else {
        const errData = await res.json();
        if (errData.error) {
          console.error("Add movie error:", errData.error);
        }
      }
    } catch (_err) {
      console.error("Add movie failed");
    } finally {
      setAddingMovieId(null);
    }
  }

  // Remove movie from room pool
  async function handleRemoveMovie(movieId: number) {
    if (!roomId) return;

    try {
      const res = await fetch("/api/rooms/movies", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, movieId }),
      });

      if (res.ok) {
        setAddedMovieIds((prev) => {
          const next = new Set(prev);
          next.delete(movieId);
          return next;
        });
        setMyMovies((prev) => prev.filter((m) => m.movie_id !== movieId));

        // If user was ready and removes a movie, un-ready them
        // if they drop below minimum
        const remaining = myMovies.filter(
          (m) => m.movie_id !== movieId,
        );
        if (isReady && remaining.length < MIN_MOVIES) {
          handleToggleReady(false);
        }
      }
    } catch (_err) {
      console.error("Remove movie failed");
    }
  }

  // Toggle ready status
  async function handleToggleReady(forceValue?: boolean) {
    if (!roomId) return;

    const newReady = forceValue !== undefined ? forceValue : !isReady;

    setReadyLoading(true);
    try {
      const res = await fetch("/api/rooms/ready", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, isReady: newReady }),
      });

      const data = await res.json();

      if (res.ok) {
        setIsReady(data.isReady);
        if (data.members) {
          setMembers(data.members);
        }
        // If both ready, the realtime subscription will handle the redirect
      } else {
        setError(data.error || "Error al cambiar estado");
        setTimeout(() => setError(null), 3000);
      }
    } catch (_err) {
      console.error("Toggle ready failed");
    } finally {
      setReadyLoading(false);
    }
  }

  // Load more recommendations
  function loadMoreRecs() {
    const nextPage = recsPage + 1;
    setRecsPage(nextPage);
    fetchRecommendations(recsCategory, nextPage);
  }

  const partner = members.find((m) => m.userId !== userId);
  const canBeReady = myMovies.length >= MIN_MOVIES;
  const isSearching = query.trim().length >= 2;
  const moviesToShow = isSearching ? searchResults : recommendations;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    );
  }

  if (error && !roomId) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <p className="text-danger text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Status Bar */}
      <div className="px-4 pt-3 pb-2">
        {/* Error toast */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-2 px-3 py-2 rounded-lg bg-danger/20 border border-danger/30 text-danger text-sm text-center"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Member status + movie counts */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-text-muted" />
            <div className="flex items-center gap-2">
              {/* My status */}
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                  isReady
                    ? "bg-success/20 text-success border border-success/30"
                    : "bg-surface-light text-text-secondary border border-primary/20"
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${isReady ? "bg-success" : "bg-text-muted"}`}
                />
                Tu ({myMovies.length})
              </div>

              {/* Partner status */}
              {partner ? (
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                    partner.isReady
                      ? "bg-success/20 text-success border border-success/30"
                      : "bg-surface-light text-text-secondary border border-primary/20"
                  }`}
                >
                  <div
                    className={`w-2 h-2 rounded-full ${partner.isReady ? "bg-success" : "bg-text-muted"}`}
                  />
                  Pareja
                  {partner.isReady && (
                    <Check className="w-3 h-3" />
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-surface-light text-text-muted border border-primary/10">
                  <div className="w-2 h-2 rounded-full bg-text-muted animate-pulse" />
                  Esperando...
                </div>
              )}
            </div>
          </div>

          {/* My list toggle */}
          <button
            onClick={() => setShowMyList(!showMyList)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors text-xs font-medium text-accent"
          >
            <Film className="w-3.5 h-3.5" />
            Mi lista ({myMovies.length})
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform ${showMyList ? "rotate-180" : ""}`}
            />
          </button>
        </div>

        {/* My movie list (collapsible) */}
        <AnimatePresence>
          {showMyList && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-3"
            >
              {myMovies.length === 0 ? (
                <p className="text-text-muted text-xs text-center py-3">
                  Aun no has agregado películas
                </p>
              ) : (
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {myMovies.map((movie) => (
                    <div
                      key={movie.id}
                      className="relative flex-shrink-0 w-20"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={getPosterUrl(movie.poster_path, "w185")}
                        alt={movie.movie_title}
                        className="w-20 h-28 rounded-lg object-cover bg-surface-light"
                      />
                      <button
                        onClick={() => handleRemoveMovie(movie.movie_id)}
                        className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-danger flex items-center justify-center shadow-md"
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                      <p className="text-[10px] text-text-muted mt-1 truncate">
                        {movie.movie_title}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {myMovies.length < MIN_MOVIES && (
                <p className="text-xs text-accent mt-1">
                  Agrega al menos {MIN_MOVIES - myMovies.length} película
                  {MIN_MOVIES - myMovies.length !== 1 ? "s" : ""} más
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
          <input
            type="text"
            placeholder="Buscar películas para agregar..."
            value={query}
            onChange={(e) => handleSearchInput(e.target.value)}
            className="input-field pl-11 pr-10"
          />
          {query && (
            <button
              onClick={() => {
                setQuery("");
                setSearchResults([]);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="w-4 h-4 text-text-muted hover:text-text-primary" />
            </button>
          )}
          {searchLoading && (
            <Loader2 className="absolute right-10 top-1/2 -translate-y-1/2 w-4 h-4 text-accent animate-spin" />
          )}
        </div>

        {/* Category tabs (only show when not searching) */}
        {!isSearching && (
          <div className="flex gap-2 mt-3">
            {(
              [
                {
                  key: "popular" as RecommendCategory,
                  label: "Populares",
                  icon: Sparkles,
                },
                {
                  key: "top_rated" as RecommendCategory,
                  label: "Mejor valoradas",
                  icon: Award,
                },
                {
                  key: "trending" as RecommendCategory,
                  label: "Tendencia",
                  icon: TrendingUp,
                },
              ] as const
            ).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setRecsCategory(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  recsCategory === key
                    ? "bg-primary/30 text-accent border border-primary/40"
                    : "bg-surface-light text-text-muted hover:text-text-secondary border border-primary/10"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Movie list */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
        {(searchLoading || recsLoading) && moviesToShow.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-accent animate-spin" />
          </div>
        ) : moviesToShow.length === 0 ? (
          <p className="text-center text-text-muted py-8">
            {isSearching
              ? "No se encontraron películas"
              : "Cargando recomendaciones..."}
          </p>
        ) : (
          <>
            {moviesToShow.map((movie) => {
              const isAdded = addedMovieIds.has(movie.id);
              const isAdding = addingMovieId === movie.id;

              return (
                <motion.div
                  key={movie.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-surface border border-primary/10 hover:border-primary/20 transition-colors"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getPosterUrl(movie.poster_path, "w185")}
                    alt={movie.title}
                    className="w-14 h-20 rounded-lg object-cover bg-surface-light flex-shrink-0"
                  />

                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm text-text-primary truncate">
                      {movie.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-text-muted">
                        {movie.release_date?.split("-")[0] || "N/A"}
                      </span>
                      {movie.vote_average > 0 && (
                        <span className="flex items-center gap-0.5 text-xs text-text-secondary">
                          <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                          {movie.vote_average.toFixed(1)}
                        </span>
                      )}
                    </div>
                    {movie.overview && (
                      <p className="text-xs text-text-muted mt-1 line-clamp-2">
                        {movie.overview}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => handleAddMovie(movie)}
                    disabled={isAdded || isAdding}
                    className={`p-2.5 rounded-full transition-all flex-shrink-0 ${
                      isAdded
                        ? "bg-success/20 text-success"
                        : isAdding
                          ? "bg-primary/20 text-accent"
                          : "bg-primary/20 text-accent hover:bg-primary/30 active:scale-90"
                    }`}
                  >
                    {isAdded ? (
                      <Check className="w-5 h-5" />
                    ) : isAdding ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Plus className="w-5 h-5" />
                    )}
                  </button>
                </motion.div>
              );
            })}

            {/* Load more button for recommendations */}
            {!isSearching && !recsLoading && (
              <button
                onClick={loadMoreRecs}
                className="w-full py-3 text-sm text-accent hover:text-text-primary transition-colors"
              >
                Cargar más películas
              </button>
            )}
            {recsLoading && moviesToShow.length > 0 && (
              <div className="flex justify-center py-3">
                <Loader2 className="w-5 h-5 text-accent animate-spin" />
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom Ready Bar */}
      <div className="px-4 py-3 border-t border-primary/10 bg-surface/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-text-muted">
              {myMovies.length} / {MIN_MOVIES} películas mínimas
            </p>
            {/* Progress bar */}
            <div className="w-full h-1.5 rounded-full bg-surface-light mt-1 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                initial={{ width: 0 }}
                animate={{
                  width: `${Math.min((myMovies.length / MIN_MOVIES) * 100, 100)}%`,
                }}
                transition={{ type: "spring", stiffness: 100 }}
              />
            </div>
          </div>

          <button
            onClick={() => handleToggleReady()}
            disabled={readyLoading || (!canBeReady && !isReady)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
              isReady
                ? "bg-success/20 text-success border border-success/30 hover:bg-success/30"
                : canBeReady
                  ? "btn-primary"
                  : "bg-surface-light text-text-muted cursor-not-allowed border border-primary/10"
            }`}
          >
            {readyLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isReady ? (
              <>
                <Check className="w-4 h-4" />
                Listo
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Estoy listo
              </>
            )}
          </button>
        </div>

        {isReady && !partner?.isReady && (
          <p className="text-xs text-text-muted mt-2 text-center animate-pulse">
            Esperando a que tu pareja esté lista...
          </p>
        )}
      </div>
    </div>
  );
}
