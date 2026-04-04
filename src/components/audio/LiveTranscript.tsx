"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Минимальные типы Web Speech API (нет в стандартном lib без DOM.Iterable и т.д.). */
type SpeechRec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onend: (() => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onresult: ((ev: SpeechRecResultEvent) => void) | null;
};

type SpeechRecResultEvent = {
  resultIndex: number;
  results: {
    length: number;
    [i: number]: { isFinal: boolean; [0]: { transcript: string } };
  };
};

/** Фразы по умолчанию: при произнесении в финальном фрагменте очищается весь накопленный транскрипт. */
export const DEFAULT_WAKE_CLEAR_PHRASES = ["серик"];

type Props = {
  /** Добавляется к накопленному тексту (финальные фразы). */
  onFinalText: (text: string) => void;
  /** Если в финальной фразе есть wakeClearPhrases — вызывается до добавления остатка текста. */
  onWakeClear?: () => void;
  /** Подстроки без учёта регистра (по умолчанию «серик»). */
  wakeClearPhrases?: readonly string[];
  /** Слушает ли сейчас микрофон. */
  active: boolean;
  className?: string;
};

export function getSpeechRecognitionCtor(): (new () => SpeechRec) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRec;
    webkitSpeechRecognition?: new () => SpeechRec;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function stripWakePhrases(text: string, phrases: readonly string[]): string {
  let remainder = text;
  for (const p of phrases) {
    const esc = p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    remainder = remainder.replace(new RegExp(esc, "gi"), " ");
  }
  return remainder.replace(/\s+/g, " ").trim();
}

function LiveTranscriptInner({
  Ctor,
  onFinalText,
  onWakeClear,
  wakeClearPhrases,
  className,
}: {
  Ctor: new () => SpeechRec;
  onFinalText: (text: string) => void;
  onWakeClear?: () => void;
  wakeClearPhrases: readonly string[];
  className?: string;
}) {
  const recRef = useRef<SpeechRec | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    const r = recRef.current;
    if (r) {
      r.onend = null;
      r.stop();
      recRef.current = null;
    }
  }, []);

  useEffect(() => {
    const rec = new Ctor();
    rec.lang = "ru-RU";
    rec.continuous = true;
    rec.interimResults = true;

    rec.onerror = (ev) => {
      setError(`Ошибка микрофона: ${ev.error}`);
    };

    rec.onresult = (ev: SpeechRecResultEvent) => {
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        if (res.isFinal) {
          const t = res[0]?.transcript?.trim();
          if (!t) continue;
          const lower = t.toLowerCase();
          const hit = wakeClearPhrases.some((p) => lower.includes(p.toLowerCase()));
          if (hit && onWakeClear) {
            onWakeClear();
            const remainder = stripWakePhrases(t, wakeClearPhrases);
            if (remainder) onFinalText(remainder + " ");
            continue;
          }
          onFinalText(t + " ");
        }
      }
    };

    rec.onend = () => {
      if (recRef.current === rec) {
        try {
          rec.start();
        } catch {
          /* ignore */
        }
      }
    };

    recRef.current = rec;
    try {
      rec.start();
    } catch {
      queueMicrotask(() =>
        setError("Не удалось запустить микрофон. Проверьте разрешения.")
      );
    }

    return () => {
      stop();
    };
  }, [Ctor, onFinalText, onWakeClear, wakeClearPhrases, stop]);

  if (error) {
    return (
      <p className={`text-xs text-amber-700 dark:text-amber-400 ${className ?? ""}`}>{error}</p>
    );
  }

  return null;
}

export function LiveTranscript({
  onFinalText,
  onWakeClear,
  wakeClearPhrases = DEFAULT_WAKE_CLEAR_PHRASES,
  active,
  className,
}: Props) {
  if (!active) return null;

  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor) {
    return (
      <p className={`text-xs text-amber-700 dark:text-amber-400 ${className ?? ""}`}>
        Распознавание речи недоступно в этом браузере (нужен Chrome / Edge).
      </p>
    );
  }

  return (
    <LiveTranscriptInner
      Ctor={Ctor}
      onFinalText={onFinalText}
      onWakeClear={onWakeClear}
      wakeClearPhrases={wakeClearPhrases}
      className={className}
    />
  );
}
