import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
    const { roomId, movieId, movieTitle, posterPath, backdropPath, vote } =
      body;

    if (!roomId || !movieId || !movieTitle || !vote) {
      return NextResponse.json(
        { error: "Faltan campos requeridos" },
        { status: 400 },
      );
    }

    if (vote !== "like" && vote !== "dislike") {
      return NextResponse.json(
        { error: "El voto debe ser 'like' o 'dislike'" },
        { status: 400 },
      );
    }

    // Verify the user is a member of this room before voting
    const { data: membership, error: memberError } = await supabase
      .from("room_members")
      .select("id")
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .single();

    if (memberError || !membership) {
      console.error("Membership check failed:", memberError);
      return NextResponse.json(
        { error: "No eres miembro de esta sala" },
        { status: 403 },
      );
    }

    // Check if the user already voted on this movie in this room
    const { data: existingVote } = await supabase
      .from("movie_votes")
      .select("id")
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .eq("movie_id", movieId)
      .single();

    if (existingVote) {
      // Update existing vote
      const { error: updateError } = await supabase
        .from("movie_votes")
        .update({ vote })
        .eq("id", existingVote.id);

      if (updateError) {
        console.error("Vote update error:", {
          message: updateError.message,
          code: updateError.code,
          details: updateError.details,
          hint: updateError.hint,
        });
        return NextResponse.json(
          { error: "Error al actualizar el voto" },
          { status: 500 },
        );
      }
    } else {
      // Insert new vote
      const { error: insertError } = await supabase
        .from("movie_votes")
        .insert({
          room_id: roomId,
          user_id: user.id,
          movie_id: movieId,
          movie_title: movieTitle,
          poster_path: posterPath || null,
          backdrop_path: backdropPath || null,
          vote,
        });

      if (insertError) {
        console.error("Vote insert error:", {
          message: insertError.message,
          code: insertError.code,
          details: insertError.details,
          hint: insertError.hint,
        });
        return NextResponse.json(
          { error: "Error al registrar el voto" },
          { status: 500 },
        );
      }
    }

    // If it's a like, check if the other person also liked it
    if (vote === "like") {
      const { data: otherLikes } = await supabase
        .from("movie_votes")
        .select("id")
        .eq("room_id", roomId)
        .eq("movie_id", movieId)
        .eq("vote", "like")
        .neq("user_id", user.id);

      if (otherLikes && otherLikes.length > 0) {
        // It's a match! Check if match already exists
        const { data: existingMatch } = await supabase
          .from("matches")
          .select("id")
          .eq("room_id", roomId)
          .eq("movie_id", movieId)
          .single();

        if (!existingMatch) {
          const { error: matchError } = await supabase
            .from("matches")
            .insert({
              room_id: roomId,
              movie_id: movieId,
              movie_title: movieTitle,
              poster_path: posterPath || null,
            });

          if (matchError) {
            console.error("Match insert error:", {
              message: matchError.message,
              code: matchError.code,
              details: matchError.details,
              hint: matchError.hint,
            });
          }
        }

        return NextResponse.json({ vote: "like", match: true });
      }
    }

    return NextResponse.json({ vote, match: false });
  } catch (error) {
    console.error("Unexpected error in POST /api/votes:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
