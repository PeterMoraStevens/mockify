import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();

  const { code } = await req.json();
  if (!code || typeof code !== "string") {
    return NextResponse.json({ error: "code required" }, { status: 400 });
  }

  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: roomId, error } = await supabase.rpc("join_room_by_code", { p_code: code });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ roomId });
}
