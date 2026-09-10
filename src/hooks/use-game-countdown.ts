"use client";

import { useEffect, useRef, useState } from "react";
import {
  updateCountdownState,
  type CountdownInput,
  type CountdownPhase,
  type CountdownState,
} from "@/lib/game/countdown.mjs";

type UseGameCountdownInput = {
  questionId: string | null | undefined;
  startsAt: string | null | undefined;
  endsAt: string | null | undefined;
  timeLimitSeconds: number | null | undefined;
  serverOffsetMs: number;
  graceMs?: number;
};

type UseGameCountdownResult = {
  phase: CountdownPhase | "idle";
  remaining: number;
  closeAtLocalMs: number | null;
};

export function useGameCountdown(input: UseGameCountdownInput): UseGameCountdownResult {
  const stateRef = useRef<CountdownState | null>(null);
  const inputRef = useRef<CountdownInput | null>(null);
  const [state, setState] = useState<CountdownState | null>(null);

  useEffect(() => {
    inputRef.current = input.questionId && input.startsAt && input.endsAt
      ? {
          questionId: input.questionId,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          timeLimitSeconds: input.timeLimitSeconds ?? 0,
          serverOffsetMs: input.serverOffsetMs,
          localNowMs: 0,
          graceMs: input.graceMs,
        }
      : null;
  }, [input.endsAt, input.graceMs, input.questionId, input.serverOffsetMs, input.startsAt, input.timeLimitSeconds]);

  useEffect(() => {
    const update = () => {
      const currentInput = inputRef.current;
      if (!currentInput) {
        stateRef.current = null;
        setState(null);
        return;
      }
      const next = updateCountdownState(stateRef.current, {
        ...currentInput,
        localNowMs: Date.now(),
      });
      if (next !== stateRef.current) {
        stateRef.current = next;
        setState(next);
      }
    };

    const initialTimer = window.setTimeout(update, 0);
    if (!input.questionId) return () => window.clearTimeout(initialTimer);
    const timer = window.setInterval(update, 100);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, [input.questionId]);

  if (!state || state.questionId !== input.questionId) {
    return { phase: "idle", remaining: 0, closeAtLocalMs: null };
  }

  return {
    phase: state.phase,
    remaining: state.remaining,
    closeAtLocalMs: state.endsAtMs + state.graceMs - state.serverOffsetMs,
  };
}
