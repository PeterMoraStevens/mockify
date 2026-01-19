import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();

  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const durationMinutes = Number(body?.durationMinutes);

  if (!Number.isFinite(durationMinutes) || durationMinutes < 30 || durationMinutes > 120) {
    return NextResponse.json(
      { error: "durationMinutes must be between 30 and 120" },
      { status: 400 }
    );
  }

  // 1) Check if user already has an active room they created
  // Adjust fields/filters to match your schema (e.g. if you have "closed" boolean)
  const nowIso = new Date().toISOString();

  const { data: existingRoom, error: existingErr } = await supabase
    .from("rooms")
    .select("id, code, expires_at")
    .eq("created_by", user.id)
    .eq("closed", false)
    .gt("expires_at", nowIso)
    .order("created_at", { ascending: false })
    .maybeSingle();

  if (existingErr) {
    return NextResponse.json({ error: existingErr.message }, { status: 400 });
  }

  if (existingRoom) {
    return NextResponse.json({
      roomId: existingRoom.id,
      code: existingRoom.code,
      expiresAt: existingRoom.expires_at,
      alreadyExists: true,
    });
  }

  // 2) Otherwise create a new room via RPC
  const { data, error } = await supabase.rpc("create_room", {
    p_duration_minutes: durationMinutes,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const room = data?.[0];
  return NextResponse.json({
    roomId: room.room_id,
    code: room.room_code,
    expiresAt: room.expires_at,
    alreadyExists: false,
  });
}
