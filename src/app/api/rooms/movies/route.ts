import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Add a movie to the room's pool (lobby phase)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const {
      roomId,
      movieId,
      movieTitle,
      posterPath,
      backdropPath,
      releaseDate,
      voteAverage,
      overview,
    } = body;

    if (!roomId || !movieId || !movieTitle) {
      return NextResponse.json(
        { error: "Faltan campos requeridos" },
        { status: 400 },
      );
    }

    // Verify the user is a member of this room
    const { data: membership } = await supabase
      .from("room_members")
      .select("id")
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json(
        { error: "No eres miembro de esta sala" },
        { status: 403 },
      );
    }

    // Verify room is in lobby status
    const { data: room } = await supabase
      .from("rooms")
      .select("status")
      .eq("id", roomId)
      .single();

    if (!room || room.status !== "lobby") {
      return NextResponse.json(
        { error: "La sala ya no está en fase de selección" },
        { status: 409 },
      );
    }

    // Check if this movie was already added by this user in this room
    const { data: existing } = await supabase
      .from("room_movies")
      .select("id")
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .eq("movie_id", movieId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "Ya agregaste esta película" },
        { status: 409 },
      );
    }

    // Insert the movie into the room pool
    const { data: inserted, error: insertError } = await supabase
      .from("room_movies")
      .insert({
        room_id: roomId,
        user_id: user.id,
        movie_id: movieId,
        movie_title: movieTitle,
        poster_path: posterPath || null,
        backdrop_path: backdropPath || null,
        release_date: releaseDate || null,
        vote_average: voteAverage || null,
        overview: overview || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Room movie insert error:", insertError);
      return NextResponse.json(
        { error: "Error al agregar la película" },
        { status: 500 },
      );
    }

    // Get count of movies added by this user in this room
    const { count } = await supabase
      .from("room_movies")
      .select("id", { count: "exact", head: true })
      .eq("room_id", roomId)
      .eq("user_id", user.id);

    return NextResponse.json(
      { movie: inserted, userMovieCount: count },
      { status: 201 },
    );
  } catch (error) {
    console.error("Unexpected error in POST /api/rooms/movies:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}

// Get all movies in a room's pool
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get("roomId");

    if (!roomId) {
      return NextResponse.json(
        { error: "roomId es requerido" },
        { status: 400 },
      );
    }

    // Verify the user is a member of this room
    const { data: membership } = await supabase
      .from("room_members")
      .select("id")
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json(
        { error: "No eres miembro de esta sala" },
        { status: 403 },
      );
    }

    // Get all movies in the room's pool
    const { data: movies, error: fetchError } = await supabase
      .from("room_movies")
      .select("*")
      .eq("room_id", roomId)
      .order("added_at", { ascending: true });

    if (fetchError) {
      console.error("Room movies fetch error:", fetchError);
      return NextResponse.json(
        { error: "Error al obtener películas" },
        { status: 500 },
      );
    }

    // Count movies per user
    const userCounts: Record<string, number> = {};
    for (const movie of movies || []) {
      userCounts[movie.user_id] = (userCounts[movie.user_id] || 0) + 1;
    }

    return NextResponse.json({
      movies: movies || [],
      userCounts,
      totalMovies: movies?.length || 0,
    });
  } catch (error) {
    console.error("Unexpected error in GET /api/rooms/movies:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}

// Remove a movie from the room's pool
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { roomId, movieId } = body;

    if (!roomId || !movieId) {
      return NextResponse.json(
        { error: "Faltan campos requeridos" },
        { status: 400 },
      );
    }

    // Verify room is still in lobby status
    const { data: room } = await supabase
      .from("rooms")
      .select("status")
      .eq("id", roomId)
      .single();

    if (!room || room.status !== "lobby") {
      return NextResponse.json(
        { error: "La sala ya no está en fase de selección" },
        { status: 409 },
      );
    }

    const { error: deleteError } = await supabase
      .from("room_movies")
      .delete()
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .eq("movie_id", movieId);

    if (deleteError) {
      console.error("Room movie delete error:", deleteError);
      return NextResponse.json(
        { error: "Error al quitar la película" },
        { status: 500 },
      );
    }

    // Get updated count
    const { count } = await supabase
      .from("room_movies")
      .select("id", { count: "exact", head: true })
      .eq("room_id", roomId)
      .eq("user_id", user.id);

    return NextResponse.json({ success: true, userMovieCount: count });
  } catch (error) {
    console.error("Unexpected error in DELETE /api/rooms/movies:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
