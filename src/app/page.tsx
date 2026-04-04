import { Suspense } from "react";
import { HomeShell } from "@/components/brainstorm/HomeShell";

/** Экспорт для ссылок и тестов; URL `?room=` переопределяет комнату. */
export { DEFAULT_BRAINSTORM_ROOM as ROOM_ID } from "@/lib/liveblocks/roomIdentity";

export default function Home() {
  return (
    <main className="flex h-dvh flex-col bg-neutral-100 dark:bg-neutral-900">
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">
            Загрузка…
          </div>
        }
      >
        <HomeShell />
      </Suspense>
    </main>
  );
}
