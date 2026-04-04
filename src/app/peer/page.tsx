"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ClientSideSuspense } from "@liveblocks/react/suspense";
import { Canvas } from "@/components/canvas/Canvas";
import { BrainstormLiveblocks } from "@/lib/liveblocks/brainstorm-liveblocks";
import { roomIdFromSearchParam } from "@/lib/liveblocks/roomIdentity";

function PeerInner() {
  const search = useSearchParams();
  const roomId = roomIdFromSearchParam(search.get("room"));

  return (
    <BrainstormLiveblocks participant="ai" roomId={roomId}>
      <div className="h-dvh w-dvw">
        <ClientSideSuspense
          fallback={
            <div className="flex h-full items-center justify-center text-sm text-neutral-500">
              Подключение ИИ к комнате…
            </div>
          }
        >
          <Canvas simulateAiCursor />
        </ClientSideSuspense>
      </div>
    </BrainstormLiveblocks>
  );
}

export default function PeerPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-dvh items-center justify-center text-sm text-neutral-500">
          Загрузка участника ИИ…
        </div>
      }
    >
      <PeerInner />
    </Suspense>
  );
}
