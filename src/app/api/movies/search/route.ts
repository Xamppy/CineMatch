import { NextRequest, NextResponse } from "next/server";
import { searchMovies } from "@/lib/tmdb";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const page = parseInt(searchParams.get("page") || "1", 10);

  if (!query || query.trim().length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const data = await searchMovies(query, page);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Movie search error:", error);
    return NextResponse.json(
      { error: "Failed to search movies" },
      { status: 500 },
    );
  }
}
