import { isValidRoomId } from "@/lib/liveblocks/roomIdentity";

/** Имя комнаты LiveKit Cloud (одна аудио-комната на brainstorm room). */
export function liveKitRoomNameFromBrainstormRoom(brainstormRoomId: string): string | null {
  const t = brainstormRoomId.trim();
  if (!isValidRoomId(t)) return null;
  return `brainstorm-${t}`;
}
