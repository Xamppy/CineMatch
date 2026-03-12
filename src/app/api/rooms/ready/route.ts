import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Toggle user ready status and optionally transition room to swiping
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
    const { roomId, isReady } = body;

    if (!roomId || typeof isReady !== "boolean") {
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

    // If marking as ready, check user has at least 5 movies
    if (isReady) {
      const { count } = await supabase
        .from("room_movies")
        .select("id", { count: "exact", head: true })
        .eq("room_id", roomId)
        .eq("user_id", user.id);

      if (!count || count < 5) {
        return NextResponse.json(
          {
            error: `Necesitas agregar al menos 5 películas (tienes ${count || 0})`,
          },
          { status: 400 },
        );
      }
    }

    // Update the user's ready status
    const { error: updateError } = await supabase
      .from("room_members")
      .update({ is_ready: isReady })
      .eq("room_id", roomId)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Ready status update error:", updateError);
      return NextResponse.json(
        { error: "Error al actualizar el estado" },
        { status: 500 },
      );
    }

    // Check if both members are now ready
    const { data: members } = await supabase
      .from("room_members")
      .select("user_id, is_ready")
      .eq("room_id", roomId);

    const allReady =
      members &&
      members.length === 2 &&
      members.every((m) => m.is_ready);

    // If both are ready, transition room to swiping
    if (allReady) {
      const { error: transitionError } = await supabase
        .from("rooms")
        .update({ status: "swiping" })
        .eq("id", roomId);

      if (transitionError) {
        console.error("Room transition error:", transitionError);
        return NextResponse.json(
          { error: "Error al iniciar la fase de votación" },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({
      isReady,
      allReady: allReady || false,
      members: members?.map((m) => ({
        userId: m.user_id,
        isReady: m.is_ready,
      })) || [],
    });
  } catch (error) {
    console.error("Unexpected error in POST /api/rooms/ready:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}

// Get current ready status of all members
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

    const { data: members } = await supabase
      .from("room_members")
      .select("user_id, is_ready")
      .eq("room_id", roomId);

    const { data: room } = await supabase
      .from("rooms")
      .select("status")
      .eq("id", roomId)
      .single();

    return NextResponse.json({
      members: members?.map((m) => ({
        userId: m.user_id,
        isReady: m.is_ready,
      })) || [],
      roomStatus: room?.status || "lobby",
      allReady:
        members &&
        members.length === 2 &&
        members.every((m) => m.is_ready),
    });
  } catch (error) {
    console.error("Unexpected error in GET /api/rooms/ready:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
