import { AccessToken, TrackSource } from "livekit-server-sdk";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { liveKitRoomNameFromBrainstormRoom } from "@/lib/livekit/roomName";

type Body = {
  room?: string;
  guestId?: string;
  displayName?: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sanitizeDisplayName(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .trim()
    .slice(0, 40)
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim();
}

export async function POST(request: Request) {
  const apiKey = process.env.LIVEKIT_API_KEY?.trim();
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
  if (!apiKey || !apiSecret) {
    return NextResponse.json(
      { error: "Задайте LIVEKIT_API_KEY и LIVEKIT_API_SECRET на сервере." },
      { status: 500 }
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const room = body.room;
  if (!room || typeof room !== "string") {
    return NextResponse.json({ error: "Missing room" }, { status: 400 });
  }

  const liveKitRoom = liveKitRoomNameFromBrainstormRoom(room);
  if (!liveKitRoom) {
    return NextResponse.json({ error: "Invalid room id" }, { status: 400 });
  }

  const authSession = await auth();
  const nameFromPreJoin = sanitizeDisplayName(body.displayName);

  let identity: string;
  let name: string;

  if (authSession?.user?.id) {
    identity = `u_${authSession.user.id}`.slice(0, 120);
    name =
      nameFromPreJoin.length > 0
        ? nameFromPreJoin
        : (authSession.user.name && authSession.user.name.trim().slice(0, 40)) ||
          authSession.user.email?.split("@")[0]?.slice(0, 40) ||
          "Участник";
  } else {
    const guestId = typeof body.guestId === "string" ? body.guestId.trim() : "";
    if (!UUID_RE.test(guestId)) {
      return NextResponse.json(
        { error: "Для гостя нужен guestId (UUID). Обновите страницу." },
        { status: 400 }
      );
    }
    identity = `g_${guestId}`;
    name = nameFromPreJoin.length > 0 ? nameFromPreJoin : "Гость";
  }

  const token = new AccessToken(apiKey, apiSecret, {
    identity,
    name,
    ttl: "6h",
  });

  token.addGrant({
    room: liveKitRoom,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishSources: [TrackSource.MICROPHONE],
  });

  try {
    const jwt = await token.toJwt();
    return NextResponse.json({
      token: jwt,
      roomName: liveKitRoom,
    });
  } catch (e) {
    console.error("[livekit-token]", e);
    return NextResponse.json({ error: "Не удалось выдать токен LiveKit" }, { status: 500 });
  }
}
