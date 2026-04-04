"use client";

import { LiveMap, type JsonObject } from "@liveblocks/client";
import { LiveblocksProvider, RoomProvider } from "@liveblocks/react/suspense";
import { useSession } from "next-auth/react";
import type { ReactNode } from "react";
import { useMemo, useRef } from "react";

import { LS_DISPLAY_NAME } from "@/lib/liveblocks/roomIdentity";

const HUMAN_STORAGE_KEY = "ai-brainstorm-canvas:human-id";

function readDisplayNameForAuth(): string | undefined {
  if (typeof localStorage === "undefined") return undefined;
  try {
    const v = localStorage.getItem(LS_DISPLAY_NAME)?.trim().slice(0, 40);
    return v && v.length > 0 ? v : undefined;
  } catch {
    return undefined;
  }
}

function getOrCreateHumanId(): string {
  try {
    const existing = localStorage.getItem(HUMAN_STORAGE_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(HUMAN_STORAGE_KEY, id);
    return id;
  } catch {
    return `human-${Math.random().toString(36).slice(2)}`;
  }
}

export function BrainstormLiveblocks({
  roomId,
  participant,
  children,
}: {
  roomId: string;
  participant: "human" | "ai";
  children: ReactNode;
}) {
  const publicKey = process.env.NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY;
  const { data: userSession, status } = useSession();
  const guestIdRef = useRef<string | null>(null);
  if (guestIdRef.current === null) {
    guestIdRef.current = getOrCreateHumanId();
  }

  const authEndpoint = useMemo(
    () => async (room?: string) => {
      if (!room) {
        throw new Error("Liveblocks: room id отсутствует в запросе авторизации.");
      }
      const payload =
        participant === "ai"
          ? { room, participant: "ai" as const }
          : status === "authenticated" && userSession?.user
            ? { room, useSessionAuth: true as const }
            : {
                room,
                userId: guestIdRef.current ?? getOrCreateHumanId(),
                displayName: readDisplayNameForAuth(),
              };

      const res = await fetch("/api/liveblocks-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "same-origin",
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Liveblocks auth failed (${res.status})`);
      }

      return res.json() as Promise<{ token: string }>;
    },
    [participant, status, userSession?.user?.id]
  );

  const providerKey = useMemo(() => {
    if (publicKey) return `pk:${roomId}`;
    if (participant === "ai") return `ai:${roomId}`;
    if (status === "authenticated" && userSession?.user?.id) {
      return `u:${roomId}:${userSession.user.id}`;
    }
    return `g:${roomId}:${guestIdRef.current}`;
  }, [publicKey, roomId, participant, status, userSession?.user?.id]);

  if (!publicKey && participant === "human" && status === "loading") {
    return (
      <div className="flex h-full min-h-[200px] flex-1 items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">
        Проверка входа…
      </div>
    );
  }

  const inner = (
    <RoomProvider
      id={roomId}
      initialPresence={{}}
      initialStorage={() => ({
        records: new LiveMap<string, JsonObject>(),
      })}
    >
      {children}
    </RoomProvider>
  );

  if (publicKey) {
    return (
      <LiveblocksProvider key={providerKey} publicApiKey={publicKey}>
        {inner}
      </LiveblocksProvider>
    );
  }

  return (
    <LiveblocksProvider key={providerKey} authEndpoint={authEndpoint}>
      {inner}
    </LiveblocksProvider>
  );
}
