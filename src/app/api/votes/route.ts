import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { roomId, movieId, movieTitle, posterPath, backdropPath, vote } = body;

  if (!roomId || !movieId || !movieTitle || !vote) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }

  if (vote !== "like" && vote !== "dislike") {
    return NextResponse.json(
      { error: "Vote must be 'like' or 'dislike'" },
      { status: 400 },
    );
  }

  // Insert the vote (upsert to handle re-votes)
  const { error: voteError } = await supabase.from("movie_votes").upsert(
    {
      room_id: roomId,
      user_id: user.id,
      movie_id: movieId,
      movie_title: movieTitle,
      poster_path: posterPath,
      backdrop_path: backdropPath,
      vote,
    },
    {
      onConflict: "room_id,user_id,movie_id",
    },
  );

  if (voteError) {
    console.error("Vote error:", voteError);
    return NextResponse.json(
      { error: "Failed to register vote" },
      { status: 500 },
    );
  }

  // If it's a like, check if the other person also liked it
  if (vote === "like") {
    const { data: otherLikes } = await supabase
      .from("movie_votes")
      .select()
      .eq("room_id", roomId)
      .eq("movie_id", movieId)
      .eq("vote", "like")
      .neq("user_id", user.id);

    if (otherLikes && otherLikes.length > 0) {
      // It's a match! Insert into matches table
      const { error: matchError } = await supabase
        .from("matches")
        .upsert(
          {
            room_id: roomId,
            movie_id: movieId,
            movie_title: movieTitle,
            poster_path: posterPath,
          },
          {
            onConflict: "room_id,movie_id",
          },
        );

      if (matchError) {
        console.error("Match insert error:", matchError);
      }

      return NextResponse.json({ vote: "like", match: true });
    }
  }

  return NextResponse.json({ vote, match: false });
}
