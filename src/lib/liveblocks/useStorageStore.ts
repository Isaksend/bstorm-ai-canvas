"use client";

import type { Json, JsonObject, LiveMap, LiveObject } from "@liveblocks/client";
import { useRoom } from "@liveblocks/react";
import { atom, react } from "@tldraw/state";
import {
  DocumentRecordType,
  InstancePresenceRecordType,
  PageRecordType,
  TLDOCUMENT_ID,
  createPresenceStateDerivation,
  isDocument,
  type TLInstancePresence,
  type TLPageId,
  type TLRecord,
} from "@tldraw/tlschema";
import type { HistoryEntry, SerializedStore } from "@tldraw/store";
import type { TLAnyShapeUtilConstructor } from "tldraw";
import {
  createTLStore,
  defaultBindingUtils,
  defaultShapeUtils,
  type TLStoreWithStatus,
} from "tldraw";
import { useEffect, useRef, useState } from "react";
import type { IndexKey } from "@tldraw/utils";

const DEFAULT_PAGE_ID = "page:page" as TLPageId;

const STORAGE_LOAD_MS = 45_000;

type LiveblocksStorageRoot = LiveObject<{ records: LiveMap<string, JsonObject> }>;

/** После round-trip через Liveblocks presence часть полей instance_presence может пропасть. */
function mergePresenceWithLiveblocksUser(
  raw: unknown,
  liveUser: { id: string; info?: { name?: string; color?: string } }
): TLInstancePresence | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Partial<TLInstancePresence> & { typeName?: string };
  if (p.typeName !== "instance_presence" || typeof p.id !== "string") return null;

  const userId =
    typeof p.userId === "string" && p.userId.length > 0 ? p.userId : String(liveUser.id ?? "");
  if (!userId) return null;

  const userName =
    typeof p.userName === "string"
      ? p.userName
      : String(liveUser.info?.name ?? "Участник");

  return { ...p, userId, userName } as TLInstancePresence;
}

function getStorageWithTimeout(room: {
  getStorage: () => Promise<{ root: LiveblocksStorageRoot }>;
}) {
  return new Promise<{ root: LiveblocksStorageRoot }>((resolve, reject) => {
    const t = setTimeout(() => {
      reject(
        new Error(
          `Таймаут загрузки storage Liveblocks (${STORAGE_LOAD_MS / 1000} с). Проверьте ключ API и сеть.`
        )
      );
    }, STORAGE_LOAD_MS);
    room.getStorage().then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    );
  });
}

function recordsFromLiveMap(liveRecords: { values(): Iterable<JsonObject> }): TLRecord[] {
  return [...liveRecords.values()]
    .filter((r) => typeof r === "object" && r !== null && "id" in r && "typeName" in r)
    .map((r) => r as unknown as TLRecord);
}

function resolveDocumentRecord(records: TLRecord[]): TLRecord {
  const found = records.find((r) => r.id === TLDOCUMENT_ID);
  if (found && isDocument(found) && typeof found.gridSize === "number") {
    return found;
  }
  return DocumentRecordType.create({ id: TLDOCUMENT_ID });
}

function resolvePageRecord(records: TLRecord[]): TLRecord {
  const found = records.find((r) => r.id === DEFAULT_PAGE_ID);
  if (
    found &&
    found.typeName === "page" &&
    typeof (found as { name?: unknown }).name === "string" &&
    typeof (found as { index?: unknown }).index === "string"
  ) {
    return found;
  }
  return PageRecordType.create({
    id: DEFAULT_PAGE_ID,
    name: "Page 1",
    index: "a1" as IndexKey,
  });
}

/** После синка из Liveblocks документ/page могли оказаться битыми — чиним и отдаём в storage. */
function repairCoreRecordsIfNeeded(store: ReturnType<typeof createTLStore>) {
  const doc = store.get(TLDOCUMENT_ID);
  if (!doc || !isDocument(doc) || typeof doc.gridSize !== "number") {
    store.put([DocumentRecordType.create({ id: TLDOCUMENT_ID })]);
  }
  const page = store.get(DEFAULT_PAGE_ID);
  if (
    !page ||
    page.typeName !== "page" ||
    typeof (page as { name?: unknown }).name !== "string" ||
    typeof (page as { index?: unknown }).index !== "string"
  ) {
    store.put([
      PageRecordType.create({
        id: DEFAULT_PAGE_ID,
        name: "Page 1",
        index: "a1" as IndexKey,
      }),
    ]);
  }
}

export function useStorageStore({
  shapeUtils = [],
  user,
}: Partial<{
  shapeUtils: TLAnyShapeUtilConstructor[];
  user: {
    id: string;
    color: string;
    name: string;
  };
}>) {
  const room = useRoom();

  const [store] = useState(() =>
    createTLStore({
      shapeUtils: [...defaultShapeUtils, ...shapeUtils],
      bindingUtils: [...defaultBindingUtils],
    })
  );

  const [storeWithStatus, setStoreWithStatus] = useState<TLStoreWithStatus>({
    status: "loading",
  });

  const userAtomRef = useRef(
    atom("liveblocks-tldraw-user", {
      id: "",
      name: "" as string | null,
      color: "" as string | null,
    })
  );

  useEffect(() => {
    if (!user) return;
    userAtomRef.current.set({
      id: user.id,
      name: user.name,
      color: user.color,
    });
    // Только id / name / color: сам объект `user` с родителя часто новый на каждом рендере.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- намеренно не [user], см. выше
  }, [user?.id, user?.name, user?.color]);

  useEffect(() => {
    if (!user) return;

    const unsubs: (() => void)[] = [];
    let cancelled = false;

    async function setup() {
      try {
        const { root } = await getStorageWithTimeout(room);
        if (cancelled) return;

        const liveRecords = root.get("records");
        if (!liveRecords) {
          setStoreWithStatus({
            status: "error",
            error: new Error("Missing Liveblocks storage root `records`"),
          });
          return;
        }

        const parsed = recordsFromLiveMap(liveRecords);
        const documentRecord = resolveDocumentRecord(parsed);
        const pageRecord = resolvePageRecord(parsed);
        const rest = parsed.filter((r) => r.id !== TLDOCUMENT_ID && r.id !== DEFAULT_PAGE_ID);

        const initialRecords = [documentRecord, pageRecord, ...rest];
        const serialized: SerializedStore<TLRecord> = Object.fromEntries(
          initialRecords.map((r) => [r.id, r])
        ) as SerializedStore<TLRecord>;

        // Не использовать store.clear(): при удалении записей срабатывают side-effects редактора
        // и падают на instance.currentPageId. loadStoreSnapshot отключает side-effects на время замены.
        store.loadStoreSnapshot({
          schema: store.schema.serialize(),
          store: serialized,
        });
        repairCoreRecordsIfNeeded(store);
        if (cancelled) return;

      unsubs.push(
        store.listen(
          ({ changes }) => {
            room.batch(() => {
              Object.values(changes.added).forEach((record) => {
                liveRecords.set(record.id, record as unknown as JsonObject);
              });
              Object.values(changes.updated).forEach(([, record]) => {
                liveRecords.set(record.id, record as unknown as JsonObject);
              });
              Object.values(changes.removed).forEach((record) => {
                liveRecords.delete(record.id);
              });
            });
          },
          { source: "user", scope: "document" }
        )
      );

      const syncPresence = (entry: HistoryEntry<TLRecord>) => {
        const { changes } = entry;
        room.batch(() => {
          Object.values(changes.added).forEach((record) => {
            room.updatePresence({ [record.id]: record as unknown as Json } as Record<string, Json>);
          });
          Object.values(changes.updated).forEach(([, record]) => {
            room.updatePresence({ [record.id]: record as unknown as Json } as Record<string, Json>);
          });
          Object.values(changes.removed).forEach((record) => {
            room.updatePresence({ [record.id]: null } as Record<string, Json>);
          });
        });
      };

      unsubs.push(store.listen(syncPresence, { source: "user", scope: "session" }));
      unsubs.push(store.listen(syncPresence, { source: "user", scope: "presence" }));

      unsubs.push(
        room.subscribe(
          liveRecords,
          (updates) => {
            const toRemove: TLRecord["id"][] = [];
            const toPut: TLRecord[] = [];

            for (const update of updates) {
              if (update.type !== "LiveMap") continue;
              for (const [id, delta] of Object.entries(update.updates)) {
                if (delta.type === "delete") {
                  toRemove.push(id as TLRecord["id"]);
                } else if (delta.type === "update") {
                  const curr = update.node.get(id);
                  if (curr && typeof curr === "object" && "typeName" in curr) {
                    toPut.push(curr as unknown as TLRecord);
                  }
                }
              }
            }

            store.mergeRemoteChanges(() => {
              if (toRemove.length) store.remove(toRemove);
              if (toPut.length) store.put(toPut);
            });
            repairCoreRecordsIfNeeded(store);
          },
          { isDeep: true }
        )
      );

      const connectionIdString = String(room.getSelf()?.connectionId ?? 0);
      const presenceDerivation = createPresenceStateDerivation(
        userAtomRef.current,
        InstancePresenceRecordType.createId(connectionIdString)
      )(store);

      const presenceAsJson = (p: TLInstancePresence | null) => p as unknown as Json;

      room.updatePresence({
        presence: presenceAsJson(presenceDerivation.get() ?? null),
      } as Record<string, Json>);

      unsubs.push(
        react("liveblocks-presence", () => {
          const presence = presenceDerivation.get() ?? null;
          requestAnimationFrame(() => {
            room.updatePresence({ presence: presenceAsJson(presence) } as Record<string, Json>);
          });
        })
      );

      unsubs.push(
        room.subscribe("others", (_others, event) => {
          const toRemove: TLInstancePresence["id"][] = [];
          const toPut: TLInstancePresence[] = [];

          switch (event.type) {
            case "leave": {
              if (event.user.connectionId != null) {
                toRemove.push(
                  InstancePresenceRecordType.createId(String(event.user.connectionId))
                );
              }
              break;
            }
            case "reset": {
              _others.forEach((other) => {
                toRemove.push(InstancePresenceRecordType.createId(String(other.connectionId)));
              });
              break;
            }
            case "enter":
            case "update": {
              const raw = (event.user.presence as { presence?: unknown } | undefined)?.presence;
              const merged = mergePresenceWithLiveblocksUser(raw, {
                id: event.user.id,
                info: event.user.info,
              });
              if (merged) {
                toPut.push(merged);
              }
              break;
            }
          }

          store.mergeRemoteChanges(() => {
            if (toRemove.length) store.remove(toRemove);
            if (toPut.length) {
              const valid = toPut.filter(
                (r) =>
                  r.typeName === "instance_presence" &&
                  typeof r.userId === "string" &&
                  r.userId.length > 0 &&
                  typeof r.userName === "string"
              );
              if (valid.length) store.put(valid);
            }
          });
        })
      );

        setStoreWithStatus({
          store,
          status: "synced-remote",
          connectionStatus: "online",
        });
      } catch (e) {
        if (!cancelled) {
          setStoreWithStatus({
            status: "error",
            error: e instanceof Error ? e : new Error(String(e)),
          });
        }
      }
    }

    void setup();

    return () => {
      cancelled = true;
      unsubs.forEach((fn) => fn());
      unsubs.length = 0;
    };
    // Не зависеть от ссылки user — иначе любой апдейт presence в Liveblocks даёт новый объект и рвёт setup().
    // eslint-disable-next-line react-hooks/exhaustive-deps -- намеренно не [user], см. выше
  }, [room, store, user?.id, user?.name, user?.color]);

  return storeWithStatus;
}
