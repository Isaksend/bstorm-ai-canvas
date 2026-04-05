"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };

type State = { error: Error | null };

export class CanvasErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[Canvas]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-2 bg-neutral-50 px-4 text-center text-sm text-red-700 dark:bg-neutral-950 dark:text-red-400">
          <p className="font-medium">Ошибка холста (tldraw)</p>
          <p className="max-w-md text-xs text-neutral-600 dark:text-neutral-400">
            {this.state.error.message}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-900 dark:hover:bg-neutral-800"
          >
            Попробовать снова
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
