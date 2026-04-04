"use client";

import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BrainstormActionsProvider } from "@/components/brainstorm/brainstorm-actions-context";
import { BrainstormRoomChrome } from "@/components/brainstorm/BrainstormRoomChrome";
import { AiPeerIframe } from "@/components/canvas/AiPeerIframe";
import { BrainstormLiveblocks } from "@/lib/liveblocks/brainstorm-liveblocks";
import { roomIdFromSearchParam } from "@/lib/liveblocks/roomIdentity";

function HomeShellInner() {
  const searchParams = useSearchParams();
  const roomId = useMemo(
    () => roomIdFromSearchParam(searchParams.get("room")),
    [searchParams]
  );
  const [nameVersion, setNameVersion] = useState(0);
  const onDisplayNameCommit = useCallback(() => {
    setNameVersion((v) => v + 1);
  }, []);

  return (
    <BrainstormActionsProvider>
      <BrainstormLiveblocks
        key={`${roomId}__${nameVersion}`}
        roomId={roomId}
        participant="human"
      >
        <BrainstormRoomChrome roomId={roomId} onDisplayNameCommit={onDisplayNameCommit} />
      </BrainstormLiveblocks>
      <AiPeerIframe roomId={roomId} />
    </BrainstormActionsProvider>
  );
}

export function HomeShell() {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <HomeShellInner />
    </div>
  );
}
