"use client";

import { useSyncExternalStore } from "react";

/**
 * Скрытый /peer с «движущимся курсором» шлёт десятки апдейтов presence/сек в ту же комнату Liveblocks.
 * На проде это часто ломает tldraw (чёрный экран / пропадает UI). Включается явно:
 * NEXT_PUBLIC_AI_PEER_IFRAME=1 или true. Локально по умолчанию включено.
 */
function aiPeerIframeEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_AI_PEER_IFRAME?.trim().toLowerCase();
  if (v === "1" || v === "true" || v === "yes") return true;
  if (v === "0" || v === "false" || v === "no") return false;
  return process.env.NODE_ENV === "development";
}

export function AiPeerIframe({ roomId }: { roomId: string }) {
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => ""
  );

  if (!aiPeerIframeEnabled()) return null;
  if (!origin) return null;

  return (
    <iframe
      title="AI spatial participant (Claude)"
      src={`${origin}/peer?room=${encodeURIComponent(roomId)}`}
      className="pointer-events-none fixed bottom-0 right-0 h-px w-px border-0 opacity-0"
      aria-hidden
    />
  );
}
