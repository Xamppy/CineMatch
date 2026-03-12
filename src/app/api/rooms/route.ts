import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MAX_ROOM_MEMBERS = 2;
const MAX_CODE_RETRIES = 5;

function generateRoomCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Create a new room
export async function POST() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("Auth error:", authError);
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Verify the user has a profile (required by FK on rooms.created_by)
    const { data: profile, error: profileCheckError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .single();

    if (profileCheckError && profileCheckError.code !== "PGRST116") {
      // PGRST116 = "not found" which is expected if profile doesn't exist
      console.error("Profile check error:", profileCheckError);
    }

    if (!profile) {
      // Auto-create profile if missing (e.g. OAuth user whose callback didn't create one)
      const username =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split("@")[0] ||
        "Usuario";
      const avatarUrl = user.user_metadata?.avatar_url || null;

      const { error: profileError } = await supabase
        .from("profiles")
        .insert({
          id: user.id,
          username,
          avatar_url: avatarUrl,
        });

      if (profileError) {
        console.error("Profile creation error:", profileError);
        return NextResponse.json(
          { error: "Error al crear perfil de usuario" },
          { status: 500 },
        );
      }
    }

    // Try to create a room with a unique code (retry on collision)
    let room = null;
    let lastError = null;

    for (let attempt = 0; attempt < MAX_CODE_RETRIES; attempt++) {
      const code = generateRoomCode();

      const { data, error: roomError } = await supabase
        .from("rooms")
        .insert({ code, created_by: user.id })
        .select()
        .single();

      if (!roomError) {
        room = data;
        break;
      }

      // If it's a unique constraint violation, retry with a new code
      if (roomError.code === "23505") {
        lastError = roomError;
        continue;
      }

      // Any other error is not retriable
      console.error("Room creation error:", {
        message: roomError.message,
        code: roomError.code,
        details: roomError.details,
        hint: roomError.hint,
      });
      return NextResponse.json(
        { error: "Error al crear la sala" },
        { status: 500 },
      );
    }

    if (!room) {
      console.error(
        "Failed to generate unique room code after retries:",
        lastError,
      );
      return NextResponse.json(
        { error: "Error al generar código de sala. Intenta de nuevo." },
        { status: 500 },
      );
    }

    // Auto-join the creator
    const { error: joinError } = await supabase
      .from("room_members")
      .insert({ room_id: room.id, user_id: user.id });

    if (joinError) {
      console.error("Room join error:", {
        message: joinError.message,
        code: joinError.code,
        details: joinError.details,
        hint: joinError.hint,
      });
      // Room was created but join failed -- still return the room
    }

    return NextResponse.json(room, { status: 201 });
  } catch (error) {
    console.error("Unexpected error in POST /api/rooms:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}

// Join an existing room by code
export async function PUT(request: NextRequest) {
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
    const { code } = body;

    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { error: "El código de sala es requerido" },
        { status: 400 },
      );
    }

    const normalizedCode = code.trim().toUpperCase();

    if (normalizedCode.length !== 6) {
      return NextResponse.json(
        { error: "El código debe tener 6 caracteres" },
        { status: 400 },
      );
    }

    // Look up the room. The RLS policy on rooms allows SELECT if the user is
    // a member or the creator. For a new joiner who is neither, this will
    // return nothing. We use an RPC function to bypass this.
    const { data: directRoom } = await supabase
      .from("rooms")
      .select("id, code")
      .eq("code", normalizedCode)
      .single();

    if (!directRoom) {
      return NextResponse.json(
        { error: "Sala no encontrada" },
        { status: 404 },
      );
    }

    // Check if already a member
    const { data: existingMember } = await supabase
      .from("room_members")
      .select("id")
      .eq("room_id", directRoom.id)
      .eq("user_id", user.id)
      .single();

    if (existingMember) {
      return NextResponse.json(directRoom);
    }

    // Check current member count (enforce max 2)
    const { count, error: countError } = await supabase
      .from("room_members")
      .select("id", { count: "exact", head: true })
      .eq("room_id", directRoom.id);

    if (countError) {
      console.error("Member count error:", countError);
      return NextResponse.json(
        { error: "Error al verificar la sala" },
        { status: 500 },
      );
    }

    if (count !== null && count >= MAX_ROOM_MEMBERS) {
      return NextResponse.json(
        { error: "La sala ya está llena (máximo 2 personas)" },
        { status: 409 },
      );
    }

    // Verify the user has a profile (required by FK on room_members.user_id)
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .single();

    if (!profile) {
      const username =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split("@")[0] ||
        "Usuario";
      const avatarUrl = user.user_metadata?.avatar_url || null;

      const { error: profileError } = await supabase
        .from("profiles")
        .insert({
          id: user.id,
          username,
          avatar_url: avatarUrl,
        });

      if (profileError) {
        console.error("Profile creation error:", profileError);
        return NextResponse.json(
          { error: "Error al crear perfil de usuario" },
          { status: 500 },
        );
      }
    }

    // Join the room
    const { error: joinError } = await supabase
      .from("room_members")
      .insert({ room_id: directRoom.id, user_id: user.id });

    if (joinError) {
      console.error("Room join error:", joinError);
      return NextResponse.json(
        { error: "Error al unirse a la sala" },
        { status: 500 },
      );
    }

    return NextResponse.json(directRoom);
  } catch (error) {
    console.error("Unexpected error in PUT /api/rooms:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
