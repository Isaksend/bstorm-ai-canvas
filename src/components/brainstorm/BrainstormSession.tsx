"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "tldraw";
import { LiveTranscript } from "@/components/audio/LiveTranscript";
import { Canvas } from "@/components/canvas/Canvas";
import { useBrainstormActionsOptional } from "@/components/brainstorm/brainstorm-actions-context";
import { AiStatusIndicator, type BrainstormAgentPhase } from "./AiStatusIndicator";
import { applyAgentToolUses } from "@/lib/canvas/applyAgentTools";
import { getCanvasSnapshotForAgent } from "@/lib/canvas/canvasSnapshot";

function formatAgentLogForUi(raw: string): { short: string; fullTitle: string } {
  const fullTitle = raw.length > 500 ? `${raw.slice(0, 500)}…` : raw;
  const lower = raw.toLowerCase();
  if (lower.includes("429") || lower.includes("too many requests") || lower.includes("resource exhausted")) {
    return {
      short:
        "429: лимит запросов Gemini (часто на бесплатном ключе). Подождите 1–2 мин. или измените транскрипт — скажите ещё слова либо «Очистить», иначе повтор того же текста не уходит.",
      fullTitle: `${raw}\n\nНастройки: GEMINI_MODEL в .env; NEXT_PUBLIC_AGENT_INTERVAL_MS=120000. Квоты: Google AI Studio → Usage.`,
    };
  }
  if (raw.length > 280) {
    return { short: `${raw.slice(0, 280)}…`, fullTitle: raw };
  }
  return { short: raw, fullTitle: raw };
}

/** Базовый интервал опроса (бесплатный Gemini — узкие RPM). Можно задать NEXT_PUBLIC_AGENT_INTERVAL_MS. */
const AGENT_BASE_INTERVAL_MS = Math.max(
  30_000,
  Number.parseInt(process.env.NEXT_PUBLIC_AGENT_INTERVAL_MS ?? "", 10) || 60_000
);
const POLL_WHEN_RATE_LIMITED_MS = 20_000;
const MIN_TRANSCRIPT_CHARS = 10;

type Props = {
  roomId: string;
  simulateAiCursor?: boolean;
};

export function BrainstormSession({ roomId, simulateAiCursor = false }: Props) {
  const editorRef = useRef<Editor | null>(null);
  const transcriptRef = useRef("");
  /** После 429 не слать тот же текст снова, пока пользователь не изменит транскрипт. */
  const rateLimitedSnapshotRef = useRef<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [micOn, setMicOn] = useState(false);
  const [agentOn, setAgentOn] = useState(false);
  const [phase, setPhase] = useState<BrainstormAgentPhase>("idle");
  const [agentLog, setAgentLog] = useState<string>("");

  useEffect(() => {
    transcriptRef.current = transcript;
    const blocked = rateLimitedSnapshotRef.current;
    if (blocked !== null && transcript.trim() !== blocked) {
      rateLimitedSnapshotRef.current = null;
    }
  }, [transcript]);

  const appendTranscript = useCallback((chunk: string) => {
    setTranscript((t) => t + chunk);
  }, []);

  const clearTranscript = useCallback(() => {
    setTranscript("");
    transcriptRef.current = "";
  }, []);

  useEffect(() => {
    setPhase((p) => {
      if (p === "thinking" || p === "acting") return p;
      return micOn ? "listening" : "idle";
    });
  }, [micOn]);

  useEffect(() => {
    if (!agentOn) return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let inFlight = false;

    const schedule = (ms: number) => {
      if (cancelled) return;
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => void run(), ms);
    };

    const run = async () => {
      if (cancelled) return;
      timeoutId = null;

      const text = transcriptRef.current.trim();
      const ed = editorRef.current;

      if (text.length < MIN_TRANSCRIPT_CHARS || !ed) {
        schedule(AGENT_BASE_INTERVAL_MS);
        return;
      }

      if (rateLimitedSnapshotRef.current !== null && text === rateLimitedSnapshotRef.current) {
        schedule(POLL_WHEN_RATE_LIMITED_MS);
        return;
      }

      if (inFlight) {
        schedule(AGENT_BASE_INTERVAL_MS);
        return;
      }

      inFlight = true;
      setPhase("thinking");
      setAgentLog("");

      try {
        const canvas = { shapes: getCanvasSnapshotForAgent(ed) };
        const res = await fetch("/api/brainstorm-agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript: text, canvas, roomId }),
        });
        const data = (await res.json()) as {
          error?: string;
          text?: string;
          toolUses?: { name: string; input: unknown }[];
        };

        if (res.status === 429) {
          rateLimitedSnapshotRef.current = text;
          setAgentLog(data.error ?? "429 Too Many Requests");
          schedule(POLL_WHEN_RATE_LIMITED_MS);
          return;
        }

        if (!res.ok) throw new Error(data.error ?? res.statusText);

        rateLimitedSnapshotRef.current = null;

        const lines: string[] = [];
        if (data.text) lines.push(data.text);
        if (data.toolUses?.length) {
          setPhase("acting");
          const logs = applyAgentToolUses(
            ed,
            data.toolUses.map((t) => ({ name: t.name, input: t.input }))
          );
          lines.push(...logs);
        }
        setAgentLog(lines.filter(Boolean).join(" · "));
        setTranscript("");
        transcriptRef.current = "";
      } catch (e) {
        setAgentLog(e instanceof Error ? e.message : String(e));
      } finally {
        inFlight = false;
        setPhase(micOn ? "listening" : "idle");
      }

      schedule(AGENT_BASE_INTERVAL_MS);
    };

    schedule(AGENT_BASE_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [agentOn, micOn, roomId]);

  const exportSummary = useCallback(async () => {
    const ed = editorRef.current;
    const snap = ed ? getCanvasSnapshotForAgent(ed) : [];
    const blob = JSON.stringify(
      { roomId, transcript, canvas: snap, exportedAt: new Date().toISOString() },
      null,
      2
    );
    try {
      await navigator.clipboard.writeText(blob);
      setAgentLog("Сводка скопирована в буфер обмена.");
    } catch {
      setAgentLog("Не удалось скопировать (разрешите буфер обмена).");
    }
  }, [roomId, transcript]);

  const actions = useBrainstormActionsOptional();
  useEffect(() => {
    if (!actions) return;
    actions.registerExport(exportSummary);
    return () => actions.registerExport(null);
  }, [actions, exportSummary]);

  const logUi = agentLog ? formatAgentLogForUi(agentLog) : null;

  return (
    <div className="relative h-full min-h-0 w-full">
      <Canvas
        simulateAiCursor={simulateAiCursor}
        onEditorReady={(ed) => {
          editorRef.current = ed;
        }}
      />

      <div className="pointer-events-none absolute inset-0 z-10">
        {/* Ниже верхней панели tldraw (меню страницы, undo, skip-link «к содержанию») */}
        <div className="pointer-events-auto absolute left-3 top-[5.25rem] z-[200] flex max-w-[min(20rem,calc(100%-1.5rem))] flex-col gap-2 sm:left-4 sm:top-[5.5rem]">
          <AiStatusIndicator phase={phase} hint={agentLog || undefined} />
          {logUi ? (
            <p
              className="max-h-28 overflow-y-auto rounded-md border border-neutral-200/90 bg-white/95 px-2 py-1.5 font-mono text-[10px] leading-snug text-neutral-600 shadow-md dark:border-neutral-600 dark:bg-neutral-900/95 dark:text-neutral-300"
              title={logUi.fullTitle}
            >
              {logUi.short}
            </p>
          ) : null}
        </div>

        {/* Низ: выше панели инструментов; pl — в сторону от зума слева; на узком экране — по центру */}
        <div className="pointer-events-auto absolute inset-x-0 bottom-0 flex flex-col items-center gap-4 px-3 pb-52 pt-2 sm:items-start sm:gap-5 sm:px-4 sm:pb-56 sm:pl-36 md:pl-10">
          <div className="flex w-full max-w-xl flex-col gap-4 sm:max-w-[min(40rem,calc(100%-2rem))]">
            <div className="flex flex-wrap items-end justify-center gap-4 sm:justify-start sm:gap-5">
              <div className="flex flex-col items-center gap-1">
                <button
                  type="button"
                  role="switch"
                  aria-checked={micOn}
                  aria-label={micOn ? "Живой звук включён" : "Включить живой звук"}
                  title={micOn ? "Выключить микрофон" : "Включить микрофон"}
                  onClick={() => setMicOn((v) => !v)}
                  className={`pointer-events-auto flex size-14 items-center justify-center rounded-full border-2 shadow-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-900 ${
                    micOn
                      ? "border-violet-400 bg-violet-600 text-white ring-2 ring-violet-500/35"
                      : "border-neutral-500 bg-neutral-800 text-neutral-300 hover:border-neutral-400"
                  }`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="size-7"
                    aria-hidden
                  >
                    <path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" />
                    <path d="M6 10.5a.75.75 0 0 1 1.5 0v.75a4.5 4.5 0 1 0 9 0v-.75a.75.75 0 0 1 1.5 0v.75a6 6 0 0 1-5.25 5.955v2.295h1.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1 0-1.5h1.5v-2.295A6 6 0 0 1 6 11.25v-.75Z" />
                  </svg>
                </button>
                <span className="text-center text-[10px] font-medium uppercase tracking-wide text-neutral-600 dark:text-neutral-400">
                  Живой звук
                </span>
              </div>

              <div className="flex flex-col items-center gap-1">
                <button
                  type="button"
                  role="switch"
                  aria-checked={agentOn}
                  title={
                    agentOn
                      ? `ИИ включён: опрос ~каждые ${Math.round(AGENT_BASE_INTERVAL_MS / 1000)} с (медленнее при лимите Gemini)`
                      : "Нажмите, чтобы включить ИИ"
                  }
                  onClick={() => setAgentOn((v) => !v)}
                  className={`pointer-events-auto flex size-14 items-center justify-center rounded-full border-2 text-xs font-bold leading-tight shadow-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-900 ${
                    agentOn
                      ? "border-violet-400 bg-violet-600 text-white ring-2 ring-violet-500/40"
                      : "border-neutral-500 bg-neutral-800 text-neutral-200 hover:border-neutral-400"
                  }`}
                >
                  ИИ
                </button>
                <span className="max-w-[9rem] text-center text-[10px] leading-snug text-neutral-500 dark:text-neutral-400">
                  {agentOn ? `~${Math.round(AGENT_BASE_INTERVAL_MS / 1000)} с` : "выкл."}
                </span>
              </div>
            </div>

            <div className="flex w-full max-w-full gap-2 sm:max-w-xl">
              <div className="max-h-24 min-h-[2.75rem] min-w-0 flex-1 overflow-y-auto rounded-lg border border-neutral-200/90 bg-white/95 px-3 py-2 text-xs text-neutral-800 shadow-md dark:border-neutral-600 dark:bg-neutral-900/95 dark:text-neutral-200">
                <span className="font-medium text-neutral-500 dark:text-neutral-400">Транскрипт </span>
                {transcript || (
                  <span className="text-neutral-400">— нажмите круг с микрофоном</span>
                )}
              </div>
              <button
                type="button"
                onClick={clearTranscript}
                disabled={!transcript}
                title="Очистить текст (можно сказать вслух «Серик»)"
                className="pointer-events-auto self-stretch rounded-lg border border-neutral-300 bg-white px-3 py-2 text-[11px] font-medium text-neutral-700 shadow-md hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
              >
                Очистить
              </button>
            </div>
          </div>
        </div>
      </div>

      <LiveTranscript
        key={micOn ? "on" : "off"}
        active={micOn}
        onFinalText={appendTranscript}
        onWakeClear={clearTranscript}
      />
    </div>
  );
}
