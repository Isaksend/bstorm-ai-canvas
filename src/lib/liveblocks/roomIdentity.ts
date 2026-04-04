export const DEFAULT_BRAINSTORM_ROOM = "brainstorm-default";

export const LS_DISPLAY_NAME = "ai-brainstorm-canvas:display-name";

const DISPLAY_NAME_MAX = 40;

/** Допустимые id комнаты Liveblocks: буквы, цифры, _ - . длиной 1–128. */
export function isValidRoomId(id: string): boolean {
  const t = id.trim();
  return t.length >= 1 && t.length <= 128 && /^[\w.-]+$/.test(t);
}

export function roomIdFromSearchParam(raw: string | null | undefined): string {
  const t = raw?.trim() ?? "";
  return isValidRoomId(t) ? t : DEFAULT_BRAINSTORM_ROOM;
}

export function getStoredDisplayName(): string {
  if (typeof window === "undefined") return "";
  try {
    const v = localStorage.getItem(LS_DISPLAY_NAME)?.trim().slice(0, DISPLAY_NAME_MAX) ?? "";
    return v;
  } catch {
    return "";
  }
}

export function setStoredDisplayName(name: string): void {
  const t = name.trim().slice(0, DISPLAY_NAME_MAX);
  try {
    if (t) localStorage.setItem(LS_DISPLAY_NAME, t);
    else localStorage.removeItem(LS_DISPLAY_NAME);
  } catch {
    /* ignore */
  }
}

export function usesLiveblocksPublicKey(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY?.trim());
}
