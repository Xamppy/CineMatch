import { NextRequest, NextResponse } from "next/server";
import { getTrendingMovies } from "@/lib/tmdb";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const timeWindow =
    (searchParams.get("window") as "day" | "week") || "week";

  try {
    const data = await getTrendingMovies(timeWindow, page);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Trending movies error:", error);
    return NextResponse.json(
      { error: "Failed to fetch trending movies" },
      { status: 500 },
    );
  }
}
