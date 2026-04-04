"use client";

import { ClientSideSuspense } from "@liveblocks/react/suspense";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { useOthers, useSelf, useStatus } from "@liveblocks/react";
import { BrainstormSession } from "@/components/brainstorm/BrainstormSession";
import {
  useBrainstormActionsOptional,
} from "@/components/brainstorm/brainstorm-actions-context";
import {
  getStoredDisplayName,
  isValidRoomId,
  setStoredDisplayName,
  usesLiveblocksPublicKey,
} from "@/lib/liveblocks/roomIdentity";

function HeaderExportButton() {
  const api = useBrainstormActionsOptional();
  if (!api) return null;
  return (
    <button
      type="button"
      disabled={!api.exportReady}
      onClick={() => void api.exportSummary()}
      title="Скопировать JSON: комната, транскрипт, холст"
      className="shrink-0 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md ring-1 ring-violet-500/30 hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-neutral-500 disabled:opacity-60 dark:ring-violet-400/20"
    >
      Сводка
    </button>
  );
}

function PresenceStrip() {
  const status = useStatus();
  const me = useSelf((u) =>
    u
      ? {
          name: String(u.info?.name ?? "Вы"),
          color: String(u.info?.color ?? "#64748b"),
        }
      : null
  );
  const others = useOthers((users) =>
    users.map((u) => ({
      key: u.connectionId,
      name: String(u.info?.name ?? "Гость"),
      color: String(u.info?.color ?? "#94a3b8"),
    }))
  );

  if (status !== "connected") {
    return (
      <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
        {status === "connecting" || status === "initial"
          ? "Подключение…"
          : status === "reconnecting"
            ? "Переподключение…"
            : "Нет связи"}
      </span>
    );
  }

  const chips: { key: string | number; name: string; color: string; self?: boolean }[] = [];
  if (me) chips.push({ key: "self", name: me.name, color: me.color, self: true });
  for (const o of others) chips.push({ key: o.key, name: o.name, color: o.color });

  if (chips.length === 0) {
    return <span className="text-[10px] text-neutral-500">Онлайн: —</span>;
  }

  return (
    <div className="flex min-w-0 max-w-[min(100%,20rem)] flex-wrap items-center justify-end gap-1.5 sm:max-w-md">
      <span className="hidden text-[10px] text-neutral-500 sm:inline dark:text-neutral-400">
        Онлайн ({chips.length}):
      </span>
      {chips.map((c) => (
        <span
          key={c.key}
          title={c.name}
          className="inline-flex max-w-[7rem] items-center gap-1 rounded-full border border-neutral-200/90 bg-white/90 px-2 py-0.5 text-[10px] font-medium text-neutral-800 shadow-sm dark:border-neutral-600 dark:bg-neutral-900/90 dark:text-neutral-100"
        >
          <span
            className="size-2 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/20"
            style={{ backgroundColor: c.color }}
            aria-hidden
          />
          <span className="truncate">{c.self ? `${c.name} (вы)` : c.name}</span>
        </span>
      ))}
    </div>
  );
}

function AuthBar() {
  const { data: session, status } = useSession();
  if (status === "loading") {
    return <span className="text-[10px] text-neutral-500 dark:text-neutral-400">Сессия…</span>;
  }
  if (session?.user) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span
          className="max-w-[14rem] truncate text-neutral-700 dark:text-neutral-200"
          title={session.user.email ?? undefined}
        >
          {session.user.name ?? session.user.email}
        </span>
        <button
          type="button"
          onClick={() => void signOut({ callbackUrl: "/" })}
          className="shrink-0 rounded-md border border-neutral-300 bg-neutral-100 px-2 py-1 font-medium hover:bg-neutral-200 dark:border-neutral-600 dark:bg-neutral-800 dark:hover:bg-neutral-700"
        >
          Выйти
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px]">
      <Link
        href="/login"
        className="rounded-md border border-neutral-300 bg-white px-2 py-1 font-medium text-violet-700 hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-900 dark:text-violet-300 dark:hover:bg-neutral-800"
      >
        Вход
      </Link>
      <Link
        href="/register"
        className="rounded-md bg-violet-600 px-2 py-1 font-medium text-white hover:bg-violet-500"
      >
        Регистрация
      </Link>
    </div>
  );
}

export function BrainstormRoomChrome({
  roomId,
  onDisplayNameCommit,
}: {
  roomId: string;
  onDisplayNameCommit: () => void;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const publicKeyOnly = usesLiveblocksPublicKey();

  const [roomDraft, setRoomDraft] = useState(roomId);
  const [nameDraft, setNameDraft] = useState("");
  const [nameApplied, setNameApplied] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");

  useEffect(() => {
    setRoomDraft(roomId);
  }, [roomId]);

  useEffect(() => {
    const n = getStoredDisplayName();
    setNameDraft(n);
    setNameApplied(n);
  }, []);

  useEffect(() => {
    setInviteUrl(`${window.location.origin}/?room=${encodeURIComponent(roomId)}`);
  }, [roomId]);

  const applyRoom = useCallback(() => {
    const next = roomDraft.trim();
    if (!isValidRoomId(next)) return;
    const q = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    q.set("room", next);
    router.replace(`/?${q.toString()}`);
  }, [roomDraft, router]);

  const applyName = useCallback(() => {
    setStoredDisplayName(nameDraft);
    setNameApplied(getStoredDisplayName());
    onDisplayNameCommit();
  }, [nameDraft, onDisplayNameCommit]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="flex shrink-0 flex-col gap-2 border-b border-neutral-200/80 bg-white px-3 py-2 dark:border-neutral-800 dark:bg-neutral-950 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 sm:px-4">
        <div className="flex w-full shrink-0 flex-wrap items-center justify-between gap-2 sm:w-auto sm:flex-1">
          <h1 className="text-sm font-medium tracking-tight text-neutral-800 dark:text-neutral-100">
            AI Brainstorm Canvas
          </h1>
          <AuthBar />
        </div>

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:gap-3">
          {!session ? (
            <label className="flex min-w-0 max-w-full items-center gap-1.5 text-[11px] text-neutral-600 dark:text-neutral-300">
              <span className="shrink-0 text-neutral-500">Имя (гость)</span>
              <input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyName()}
                placeholder="Без входа в аккаунт"
                maxLength={40}
                className="min-w-[6rem] max-w-[10rem] flex-1 rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-900 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100"
              />
              <button
                type="button"
                onClick={applyName}
                className="shrink-0 rounded-md border border-neutral-300 bg-neutral-100 px-2 py-1 text-[11px] font-medium hover:bg-neutral-200 dark:border-neutral-600 dark:bg-neutral-800 dark:hover:bg-neutral-700"
              >
                OK
              </button>
            </label>
          ) : (
            <p className="text-[10px] text-neutral-500 dark:text-neutral-400">
              На холсте используется имя из аккаунта (Liveblocks + вход).
            </p>
          )}

          {publicKeyOnly ? (
            <p className="text-[10px] leading-tight text-amber-700 dark:text-amber-400/90">
              Свой ник — только с <code className="rounded bg-neutral-200 px-0.5 dark:bg-neutral-800">LIVEBLOCKS_SECRET_KEY</code>
              , без публичного ключа.
            </p>
          ) : null}

          <label className="flex min-w-0 max-w-full flex-1 items-center gap-1.5 text-[11px] text-neutral-600 dark:text-neutral-300 sm:max-w-[14rem]">
            <span className="shrink-0 font-mono text-[10px] text-neutral-500">room</span>
            <input
              value={roomDraft}
              onChange={(e) => setRoomDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyRoom()}
              spellCheck={false}
              className="min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-2 py-1 font-mono text-xs text-neutral-900 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100"
            />
            <button
              type="button"
              onClick={applyRoom}
              disabled={!isValidRoomId(roomDraft.trim())}
              className="shrink-0 rounded-md border border-neutral-300 bg-neutral-100 px-2 py-1 text-[11px] font-medium hover:bg-neutral-200 disabled:opacity-40 dark:border-neutral-600 dark:bg-neutral-800 dark:hover:bg-neutral-700"
            >
              Перейти
            </button>
          </label>
        </div>

        <div className="flex min-w-0 items-center justify-between gap-2 sm:justify-end">
          <PresenceStrip />
          <HeaderExportButton />
        </div>

        <p className="w-full text-[10px] text-neutral-500 dark:text-neutral-400">
          Ссылка на эту комнату:{" "}
          <code className="break-all rounded bg-neutral-100 px-1 dark:bg-neutral-800">
            {inviteUrl || `/?room=${encodeURIComponent(roomId)}`}
          </code>
          {!session && nameApplied ? (
            <span className="ml-2 text-neutral-400">· гость: «{nameApplied}»</span>
          ) : null}
          {session?.user?.email ? (
            <span className="ml-2 text-neutral-400">· {session.user.email}</span>
          ) : null}
        </p>
      </header>

      <div className="relative min-h-0 flex-1">
        <ClientSideSuspense
          fallback={
            <div className="flex h-full min-h-[200px] items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">
              Синхронизация холста…
            </div>
          }
        >
          <BrainstormSession roomId={roomId} />
        </ClientSideSuspense>
      </div>
    </div>
  );
}
