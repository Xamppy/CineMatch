const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

function getApiKey(): string {
  const key = process.env.TMDB_API_KEY;
  if (!key) {
    throw new Error("TMDB_API_KEY environment variable is not set");
  }
  return key;
}

export interface TMDBMovie {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
}

export interface TMDBSearchResponse {
  page: number;
  results: TMDBMovie[];
  total_pages: number;
  total_results: number;
}

export function getPosterUrl(
  path: string | null,
  size: "w185" | "w342" | "w500" | "w780" | "original" = "w500",
): string {
  if (!path) return "/placeholder-poster.svg";
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

export function getBackdropUrl(
  path: string | null,
  size: "w300" | "w780" | "w1280" | "original" = "w780",
): string {
  if (!path) return "/placeholder-backdrop.svg";
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

export async function searchMovies(
  query: string,
  page: number = 1,
): Promise<TMDBSearchResponse> {
  const apiKey = getApiKey();
  const url = `${TMDB_BASE_URL}/search/movie?api_key=${apiKey}&query=${encodeURIComponent(query)}&page=${page}&language=es-ES&include_adult=false`;

  const response = await fetch(url, { next: { revalidate: 300 } });

  if (!response.ok) {
    throw new Error(`TMDB search failed: ${response.status}`);
  }

  return response.json();
}

export async function getTrendingMovies(
  timeWindow: "day" | "week" = "week",
  page: number = 1,
): Promise<TMDBSearchResponse> {
  const apiKey = getApiKey();
  const url = `${TMDB_BASE_URL}/trending/movie/${timeWindow}?api_key=${apiKey}&page=${page}&language=es-ES`;

  const response = await fetch(url, { next: { revalidate: 3600 } });

  if (!response.ok) {
    throw new Error(`TMDB trending failed: ${response.status}`);
  }

  return response.json();
}

export async function getMovieDetails(movieId: number) {
  const apiKey = getApiKey();
  const url = `${TMDB_BASE_URL}/movie/${movieId}?api_key=${apiKey}&language=es-ES`;

  const response = await fetch(url, { next: { revalidate: 86400 } });

  if (!response.ok) {
    throw new Error(`TMDB movie details failed: ${response.status}`);
  }

  return response.json();
}
