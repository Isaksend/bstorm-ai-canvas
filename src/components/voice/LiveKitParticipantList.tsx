"use client";

import { useIsSpeaking, useParticipants } from "@livekit/components-react";
import type { Participant } from "livekit-client";

function ParticipantRow({ participant }: { participant: Participant }) {
  const speaking = useIsSpeaking(participant);
  const label = participant.name?.trim() || participant.identity;

  return (
    <li className="flex min-w-0 items-center gap-2 text-[11px] text-sky-100">
      <span
        className={`size-2 shrink-0 rounded-full ring-1 ring-white/20 ${
          speaking ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]" : "bg-sky-900/80"
        }`}
        title={speaking ? "Говорит" : "Тихо"}
        aria-hidden
      />
      <span className="min-w-0 truncate" title={label}>
        {label}
        {participant.isLocal ? (
          <span className="ml-1 text-[9px] font-normal text-sky-300/80">(вы)</span>
        ) : null}
      </span>
    </li>
  );
}

export function LiveKitParticipantList() {
  const participants = useParticipants();

  return (
    <div className="rounded-md border border-sky-500/35 bg-black/25 px-2 py-1.5">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-sky-200/90">
        В звонке ({participants.length})
      </p>
      <ul className="max-h-28 space-y-1 overflow-y-auto pr-0.5">
        {participants.map((p) => (
          <ParticipantRow key={p.identity} participant={p} />
        ))}
      </ul>
    </div>
  );
}
