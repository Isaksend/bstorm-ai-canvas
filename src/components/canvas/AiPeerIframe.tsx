"use client";

import { useSyncExternalStore } from "react";

export function AiPeerIframe({ roomId }: { roomId: string }) {
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => ""
  );

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
