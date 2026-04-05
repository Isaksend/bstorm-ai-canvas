"use client";

import type { LocalUserChoices } from "@livekit/components-core";
import {
  ControlBar,
  LiveKitRoom,
  PreJoin,
  RoomAudioRenderer,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { useCallback, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { getStoredDisplayName } from "@/lib/liveblocks/roomIdentity";
import { LiveKitParticipantList } from "@/components/voice/LiveKitParticipantList";

const LS_LIVEKIT_GUEST = "ai-brainstorm-canvas:livekit-guest-id";

function getOrCreateGuestId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = localStorage.getItem(LS_LIVEKIT_GUEST);
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      id = crypto.randomUUID();
      localStorage.setItem(LS_LIVEKIT_GUEST, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

type Props = {
  roomId: string;
  /** Микрофон «Живой звук» и WebRTC не должны работать одновременно. */
  onVoiceActiveChange?: (active: boolean) => void;
};

export function LiveKitAudioDock({ roomId, onVoiceActiveChange }: Props) {
  const { data: session, status: sessionStatus } = useSession();
  const serverUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL?.trim() ?? "";
  const configured = serverUrl.startsWith("wss://") || serverUrl.startsWith("ws://");

  const [prejoinOpen, setPrejoinOpen] = useState(false);
  const [joinChoices, setJoinChoices] = useState<LocalUserChoices | null>(null);
  const [token, setToken] = useState<string | undefined>(undefined);
  const [connect, setConnect] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const joined = Boolean(token && connect);

  const preJoinDefaults = useMemo<Partial<LocalUserChoices>>(
    () => ({
      videoEnabled: false,
      audioEnabled: true,
      username:
        session?.user?.name?.trim() ||
        session?.user?.email?.split("@")[0]?.trim() ||
        getStoredDisplayName() ||
        "Гость",
    }),
    [session?.user?.name, session?.user?.email]
  );

  const fetchTokenAndConnect = useCallback(
    async (choices: LocalUserChoices) => {
      setBusy(true);
      setError(null);
      onVoiceActiveChange?.(true);
      try {
        const body: { room: string; guestId?: string; displayName?: string } = {
          room: roomId,
          displayName: choices.username.trim().slice(0, 40),
        };
        if (!session?.user?.id) {
          body.guestId = getOrCreateGuestId();
        }

        const res = await fetch("/api/livekit-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = (await res.json()) as { error?: string; token?: string };
        if (!res.ok) {
          throw new Error(data.error ?? res.statusText);
        }
        if (!data.token) {
          throw new Error("Нет токена");
        }
        setJoinChoices(choices);
        setToken(data.token);
        setConnect(true);
        setPrejoinOpen(false);
      } catch (e) {
        onVoiceActiveChange?.(false);
        setError(e instanceof Error ? e.message : String(e));
        setJoinChoices(null);
        setToken(undefined);
        setConnect(false);
      } finally {
        setBusy(false);
      }
    },
    [roomId, session?.user?.id, onVoiceActiveChange]
  );

  const leave = useCallback(() => {
    setConnect(false);
    setToken(undefined);
    setJoinChoices(null);
    setPrejoinOpen(false);
    onVoiceActiveChange?.(false);
  }, [onVoiceActiveChange]);

  const cancelPrejoin = useCallback(() => {
    setPrejoinOpen(false);
    setError(null);
  }, []);

  const audioCapture =
    joinChoices?.audioEnabled === true
      ? {
          deviceId: joinChoices.audioDeviceId?.trim()
            ? joinChoices.audioDeviceId
            : undefined,
        }
      : false;

  if (!configured) {
    return (
      <div className="flex flex-col items-center gap-1">
        <button
          type="button"
          disabled
          title="Задайте NEXT_PUBLIC_LIVEKIT_URL (wss://… из LiveKit Cloud)"
          className="flex size-14 cursor-not-allowed items-center justify-center rounded-full border-2 border-neutral-600 bg-neutral-800 text-[10px] font-bold text-neutral-500"
        >
          Звонок
        </button>
        <span className="max-w-[9rem] text-center text-[10px] text-neutral-500 dark:text-neutral-400">
          нет URL
        </span>
      </div>
    );
  }

  if (sessionStatus === "loading") {
    return (
      <div className="flex flex-col items-center gap-1">
        <div className="flex size-14 items-center justify-center rounded-full border-2 border-neutral-600 bg-neutral-800 text-[10px] text-neutral-400">
          …
        </div>
        <span className="text-[10px] text-neutral-500">сессия…</span>
      </div>
    );
  }

  if (joined) {
    return (
      <div className="flex w-full min-w-0 basis-full flex-col gap-2 rounded-lg border border-sky-600/40 bg-sky-950/40 px-2 py-2 shadow-md dark:bg-sky-950/50">
        <LiveKitRoom
          serverUrl={serverUrl}
          token={token}
          connect={connect}
          audio={audioCapture}
          video={false}
          onDisconnected={() => {
            leave();
          }}
          onError={(err) => {
            setError(err.message);
          }}
          className="flex flex-col gap-2"
        >
          <LiveKitParticipantList />
          <RoomAudioRenderer />
          <ControlBar
            variation="minimal"
            controls={{
              microphone: true,
              camera: false,
              chat: false,
              screenShare: false,
              leave: true,
              settings: false,
            }}
          />
        </LiveKitRoom>
        {error ? (
          <p className="text-center text-[9px] text-red-600 dark:text-red-400">{error}</p>
        ) : null}
      </div>
    );
  }

  if (prejoinOpen) {
    return (
      <div
        className={`lk-audio-only-prejoin flex w-full min-w-0 basis-full flex-col gap-2 rounded-lg border border-sky-600/50 bg-sky-950/50 px-3 py-3 shadow-md dark:bg-sky-950/60 ${
          busy ? "pointer-events-none opacity-70" : ""
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-medium text-sky-100">Перед звонком</p>
          <button
            type="button"
            onClick={cancelPrejoin}
            disabled={busy}
            className="rounded-md border border-sky-500/40 bg-sky-900/50 px-2 py-1 text-[10px] font-medium text-sky-100 hover:bg-sky-800/60 disabled:opacity-50"
          >
            Отмена
          </button>
        </div>
        <PreJoin
          key={`${roomId}-${session?.user?.id ?? "guest"}`}
          defaults={preJoinDefaults}
          persistUserChoices
          joinLabel={busy ? "Подключение…" : "Войти в комнату"}
          micLabel="Микрофон"
          camLabel="Камера"
          userLabel="Как вас слышат"
          onValidate={(v) => v.username.trim().length > 0}
          onError={(err) => setError(err.message)}
          onSubmit={(values) => {
            void fetchTokenAndConnect(values);
          }}
          className="!max-w-none"
        />
        {error ? (
          <p className="text-center text-[10px] text-red-600 dark:text-red-400">{error}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setError(null);
          setPrejoinOpen(true);
        }}
        title="Голосовая комната LiveKit: сначала выбор микрофона. Отключит «Живой звук» после входа."
        className={`flex size-14 items-center justify-center rounded-full border-2 text-xs font-bold leading-tight shadow-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-900 ${
          busy
            ? "border-neutral-600 bg-neutral-800 text-neutral-500"
            : "border-sky-500 bg-sky-700 text-white hover:border-sky-400"
        }`}
      >
        {busy ? "…" : "▶"}
      </button>
      <span className="max-w-[9rem] text-center text-[10px] leading-snug text-neutral-500 dark:text-neutral-400">
        звонок
      </span>
    </div>
  );
}
