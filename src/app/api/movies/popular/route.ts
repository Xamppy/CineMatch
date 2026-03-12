import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPopularMovies, getTopRatedMovies } from "@/lib/tmdb";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const category = searchParams.get("category") || "popular";

  try {
    const data =
      category === "top_rated"
        ? await getTopRatedMovies(page)
        : await getPopularMovies(page);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Popular/top-rated movies error:", error);
    return NextResponse.json(
      { error: "Error al obtener películas" },
      { status: 500 },
    );
  }
}
