"use client";

export type BrainstormAgentPhase = "idle" | "listening" | "thinking" | "acting";

const LABELS: Record<BrainstormAgentPhase, string> = {
  idle: "Готов",
  listening: "Слушаю",
  thinking: "Думаю",
  acting: "На холсте",
};

export function AiStatusIndicator({
  phase,
  hint,
}: {
  phase: BrainstormAgentPhase;
  hint?: string;
}) {
  const dot =
    phase === "idle"
      ? "bg-neutral-400"
      : phase === "listening"
        ? "animate-pulse bg-emerald-500"
        : phase === "thinking"
          ? "animate-pulse bg-amber-500"
          : "animate-pulse bg-violet-500";

  return (
    <div
      className="pointer-events-auto flex max-w-[min(100vw-2rem,20rem)] items-center gap-2 rounded-full border border-neutral-200/90 bg-white/95 px-3 py-1.5 text-xs text-neutral-700 shadow-sm backdrop-blur-sm dark:border-neutral-700 dark:bg-neutral-900/95 dark:text-neutral-200"
      title={hint}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden />
      <span className="font-medium">ИИ</span>
      <span className="truncate text-neutral-500 dark:text-neutral-400">{LABELS[phase]}</span>
    </div>
  );
}
