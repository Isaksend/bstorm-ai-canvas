"use client";

import { useSyncExternalStore } from "react";

/**
 * Скрытый /peer синкает второй клиент в комнату и грузит Liveblocks/tldraw.
 * По умолчанию везде ВЫКЛ — включайте только при необходимости: NEXT_PUBLIC_AI_PEER_IFRAME=1
 */
function aiPeerIframeEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_AI_PEER_IFRAME?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
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
