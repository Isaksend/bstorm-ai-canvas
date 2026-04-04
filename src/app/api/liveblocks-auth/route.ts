import { Liveblocks } from "@liveblocks/node";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

type Body = {
  room?: string;
  participant?: "ai";
  userId?: string;
  /** Отображаемое имя (гость, LIVEBLOCKS_SECRET_KEY). */
  displayName?: string;
  /** Взять пользователя из сессии NextAuth (cookies). */
  useSessionAuth?: boolean;
};

function colorFromUserId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (Math.imul(31, h) + id.charCodeAt(i)) >>> 0;
  }
  const hue = h % 360;
  return `hsl(${hue} 52% 44%)`;
}

function sanitizeDisplayName(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .trim()
    .slice(0, 40)
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim();
}

export async function POST(request: Request) {
  const secret = process.env.LIVEBLOCKS_SECRET_KEY;
  if (!secret) {
    return NextResponse.json(
      { error: "Задайте LIVEBLOCKS_SECRET_KEY или используйте NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY." },
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

  const liveblocks = new Liveblocks({ secret });
  const authSession = await auth();

  if (body.participant === "ai") {
    const lb = liveblocks.prepareSession("participant-ai-claude", {
      userInfo: {
        name: "Claude · AI",
        color: "#7c3aed",
      },
    });
    lb.allow(room, lb.FULL_ACCESS);
    const { status, body: responseBody } = await lb.authorize();
    return new NextResponse(responseBody, { status });
  }

  if (body.useSessionAuth) {
    if (!authSession?.user?.id) {
      return NextResponse.json({ error: "Требуется войти в аккаунт" }, { status: 401 });
    }
    const displayName =
      (authSession.user.name && authSession.user.name.trim().slice(0, 40)) ||
      authSession.user.email?.split("@")[0]?.slice(0, 40) ||
      "Участник";
    const lb = liveblocks.prepareSession(authSession.user.id, {
      userInfo: {
        name: displayName,
        color: colorFromUserId(authSession.user.id),
      },
    });
    lb.allow(room, lb.FULL_ACCESS);
    const { status, body: responseBody } = await lb.authorize();
    return new NextResponse(responseBody, { status });
  }

  const userId =
    typeof body.userId === "string" && body.userId.length > 0
      ? body.userId
      : `anon-${crypto.randomUUID()}`;

  const customName = sanitizeDisplayName(body.displayName);
  const displayName = customName.length > 0 ? customName : "Участник";

  const lb = liveblocks.prepareSession(userId, {
    userInfo: {
      name: displayName,
      color: colorFromUserId(userId),
    },
  });
  lb.allow(room, lb.FULL_ACCESS);
  const { status, body: responseBody } = await lb.authorize();
  return new NextResponse(responseBody, { status });
}
