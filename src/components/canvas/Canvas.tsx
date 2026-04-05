"use client";

import { useSelf, useStatus } from "@liveblocks/react";
import type { Editor } from "tldraw";
import { Tldraw } from "tldraw";
import "tldraw/tldraw.css";
import { useStorageStore } from "@/lib/liveblocks/useStorageStore";
import { CanvasErrorBoundary } from "@/components/canvas/CanvasErrorBoundary";

type CanvasProps = {
  /** Второй клиент (ИИ) двигает указатель, чтобы на основном холсте был виден его курсор. */
  simulateAiCursor?: boolean;
  /** Вызывается после монтирования редактора (для агента и инструментов). */
  onEditorReady?: (editor: Editor) => void;
};

export function Canvas({ simulateAiCursor = false, onEditorReady }: CanvasProps) {
  const status = useStatus();
  const liveUser = useSelf((m) =>
    m
      ? {
          id: m.id,
          color: m.info?.color ?? "#64748b",
          name: m.info?.name ?? "Гость",
        }
      : null
  );

  const storeState = useStorageStore(
    status === "connected" && liveUser
      ? {
          user: liveUser,
        }
      : {}
  );

  if (status === "disconnected") {
    return (
      <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-2 bg-neutral-50 px-4 text-center text-sm text-neutral-700 dark:bg-neutral-950 dark:text-neutral-200">
        <p className="font-medium">Нет соединения с Liveblocks</p>
        <p className="max-w-md text-xs text-neutral-500">
          Проверьте ключ в <code className="rounded bg-neutral-200 px-1 dark:bg-neutral-800">.env.local</code>
          (публичный или секретный + <code className="rounded bg-neutral-200 px-1 dark:bg-neutral-800">/api/liveblocks-auth</code>
          ), интернет и доступ к WebSocket (корпоративные сети иногда режут wss).
        </p>
      </div>
    );
  }

  if (status !== "connected" || !liveUser) {
    const hint =
      status === "initial" || status === "connecting"
        ? "Подключение…"
        : status === "reconnecting"
          ? "Переподключение…"
          : "Ожидание…";
    return (
      <div className="flex h-full min-h-[240px] items-center justify-center bg-neutral-50 text-sm text-neutral-500 dark:bg-neutral-950">
        {hint}
      </div>
    );
  }

  if (storeState.status === "loading") {
    return (
      <div className="flex h-full min-h-[240px] items-center justify-center bg-neutral-50 text-sm text-neutral-500 dark:bg-neutral-950">
        Синхронизация холста…
      </div>
    );
  }

  if (storeState.status === "error") {
    return (
      <div className="flex h-full min-h-[240px] items-center justify-center bg-neutral-50 px-4 text-center text-sm text-red-600 dark:bg-neutral-950">
        {storeState.error.message}
      </div>
    );
  }

  return (
    <div className="relative z-0 h-full w-full min-h-0">
      <CanvasErrorBoundary>
        <Tldraw
          store={storeState.store}
          autoFocus
          onMount={(editor) => {
            onEditorReady?.(editor);
            if (!simulateAiCursor) return;
            const container = editor.getContainer();
            const start = performance.now();
            let raf = 0;
            /** Не чаще ~4 Гц: иначе каждый кадр гонит presence в Liveblocks и валит основной холст. */
            const minMs = 250;
            let lastEmit = 0;

            function tick(now: number) {
              const t = (now - start) / 1000;
              const rect = container.getBoundingClientRect();
              const rx = Math.min(rect.width * 0.28, 220);
              const ry = Math.min(rect.height * 0.22, 160);
              const cx = rect.width * 0.5 + Math.cos(t * 0.65) * rx;
              const cy = rect.height * 0.42 + Math.sin(t * 0.5) * ry;
              if (now - lastEmit >= minMs) {
                lastEmit = now;
                container.dispatchEvent(
                  new PointerEvent("pointermove", {
                    bubbles: true,
                    cancelable: true,
                    clientX: rect.left + cx,
                    clientY: rect.top + cy,
                    pointerId: 1,
                    pointerType: "mouse",
                    isPrimary: true,
                  })
                );
              }
              raf = requestAnimationFrame(tick);
            }

            raf = requestAnimationFrame(tick);
            return () => cancelAnimationFrame(raf);
          }}
        />
      </CanvasErrorBoundary>
    </div>
  );
}
