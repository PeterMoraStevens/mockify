/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/rooms/close/route.ts
import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const { roomId } = await req.json();
    console.log(roomId)
    if (!roomId) {
      return NextResponse.json(
        { error: "roomId is required" },
        { status: 400 },
      );
    }

    // User-authenticated client (checks who is calling)
    const supabase = await createClient();
    const { data: auth, error: authErr } = await supabase.auth.getUser();
    if (authErr || !auth?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Load room + verify permissions
    const { data: room, error: roomErr } = await supabase
      .from("rooms")
      .select("id, created_by, closed")
      .eq("id", roomId)
      .single();

    if (roomErr || !room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    if (room.closed) {
      return NextResponse.json({ ok: true, alreadyClosed: true });
    }

    if (room.created_by !== auth.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Admin client (service role) for guaranteed update + broadcast
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );

    // 1) Mark room closed
    const { error: closeErr } = await admin
      .from("rooms")
      .update({
        closed: true,
      })
      .eq("id", roomId);

    if (closeErr) {
      return NextResponse.json({ error: closeErr.message }, { status: 500 });
    }

    // 3) Broadcast to everyone in the room
    const topic = `room:${roomId}`;
    await admin.channel(topic).send({
      type: "broadcast",
      event: "room_closed",
      payload: {
        room_id: roomId,
        by: auth.user.id,
        at: new Date().toISOString(),
        reason: "closed_by_host",
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500 },
    );
  }
}
