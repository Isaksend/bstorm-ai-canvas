import type { JsonObject, LiveMap } from "@liveblocks/client";

declare global {
  interface Liveblocks {
    /** Динамические ключи — id ephemeral-записей tldraw; значения сериализуются как JSON. */
    Presence: JsonObject;
    Storage: {
      records: LiveMap<string, JsonObject>;
    };
    UserMeta: {
      id: string;
      info: {
        name: string;
        color: string;
        avatar?: string;
      };
    };
  }
}

export {};
