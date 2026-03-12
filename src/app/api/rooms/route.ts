import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const code = generateRoomCode();

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .insert({ code, created_by: user.id })
    .select()
    .single();

  if (roomError) {
    console.error("Room creation error:", roomError);
    return NextResponse.json(
      { error: "Failed to create room" },
      { status: 500 },
    );
  }

  // Auto-join the creator
  const { error: joinError } = await supabase
    .from("room_members")
    .insert({ room_id: room.id, user_id: user.id });

  if (joinError) {
    console.error("Room join error:", joinError);
  }

  return NextResponse.json(room, { status: 201 });
}

// Join an existing room by code
export async function PUT(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { code } = body;

  if (!code) {
    return NextResponse.json(
      { error: "Room code is required" },
      { status: 400 },
    );
  }

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select()
    .eq("code", code.toUpperCase())
    .single();

  if (roomError || !room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  // Check if already a member
  const { data: existingMember } = await supabase
    .from("room_members")
    .select()
    .eq("room_id", room.id)
    .eq("user_id", user.id)
    .single();

  if (!existingMember) {
    const { error: joinError } = await supabase
      .from("room_members")
      .insert({ room_id: room.id, user_id: user.id });

    if (joinError) {
      console.error("Room join error:", joinError);
      return NextResponse.json(
        { error: "Failed to join room" },
        { status: 500 },
      );
    }
  }

  return NextResponse.json(room);
}
