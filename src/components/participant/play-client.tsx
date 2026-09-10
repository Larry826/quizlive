"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, Hourglass } from "lucide-react";
import { AnswerGrid } from "@/components/game/answer-grid";
import { useGameCountdown } from "@/hooks/use-game-countdown";
import { ANSWER_NETWORK_GRACE_MS } from "@/lib/game/constants";
import {
  estimateServerOffsetMs,
  reconcileSubmittedAnswer,
  shouldApplyResponse,
} from "@/lib/game/countdown.mjs";
import { createBrowserClient } from "@/lib/supabase/browser";

type Participant = { id: string; nickname: string; score: number };
type QuestionPayload = {
  status: string;
  questionIndex: number;
  totalQuestions: number;
  questionStartedAt: string | null;
  questionStartsAt: string | null;
  questionEndsAt: string | null;
  serverNow: string;
  submittedAnswerId: string | null;
  question: null | {
    id: string;
    order_index: number;
    time_limit: number;
    answers: { id: string; answer_index: number }[];
  };
};

export function PlayClient({ gameId }: { gameId: string }) {
  const router = useRouter();
  const [participant] = useState<Participant | null>(() => {
    if (typeof window === "undefined") return null;
    const stored = sessionStorage.getItem(`quizlive:${gameId}:participant`);
    return stored ? (JSON.parse(stored) as Participant) : null;
  });
  const [gameState, setGameState] = useState<QuestionPayload | null>(null);
  const [question, setQuestion] = useState<QuestionPayload | null>(null);
  const [selected, setSelected] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [questionClock, setQuestionClock] = useState({ questionId: "", offsetMs: 0 });
  const latestRequestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const currentQuestionIdRef = useRef("");
  const selectedRef = useRef("");
  const submittedRef = useRef(false);

  const refresh = useCallback(async () => {
    const requestId = ++latestRequestIdRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestStartedAt = performance.now();

    try {
      const response = await fetch(`/api/games/${gameId}/question?participantId=${participant?.id ?? ""}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const requestEndedAt = performance.now();
      if (!response.ok || !shouldApplyResponse(requestId, latestRequestIdRef.current)) return;

      const payload = (await response.json()) as QuestionPayload;
      if (!shouldApplyResponse(requestId, latestRequestIdRef.current)) return;

      setGameState(payload);
      if (payload.status === "FINISHED") {
        router.push(`/results/${gameId}`);
        return;
      }

      if (payload.status !== "QUESTION" || !payload.question) {
        setQuestion(null);
        return;
      }

      const nextQuestionId = payload.question.id;
      const isNewQuestion = currentQuestionIdRef.current !== nextQuestionId;
      const reconciledAnswerId = reconcileSubmittedAnswer({
        currentQuestionId: currentQuestionIdRef.current,
        nextQuestionId,
        optimisticAnswerId: selectedRef.current,
        serverAnswerId: payload.submittedAnswerId,
      });
      if (isNewQuestion) {
        const offsetMs = estimateServerOffsetMs(
          payload.serverNow,
          requestEndedAt - requestStartedAt,
          Date.now(),
        );
        currentQuestionIdRef.current = nextQuestionId;
        setQuestionClock({ questionId: nextQuestionId, offsetMs });
        setQuestion(payload);
        selectedRef.current = reconciledAnswerId;
        submittedRef.current = Boolean(reconciledAnswerId);
        setSelected(selectedRef.current);
        setSubmitted(submittedRef.current);
        setSubmitError("");
      } else if (reconciledAnswerId && !submittedRef.current) {
        selectedRef.current = reconciledAnswerId;
        submittedRef.current = true;
        setSelected(reconciledAnswerId);
        setSubmitted(true);
      }
    } catch (error) {
      if (
        !(error instanceof DOMException && error.name === "AbortError") &&
        process.env.NODE_ENV !== "production"
      ) {
        console.debug("participant state refresh failed", error);
      }
    }
  }, [gameId, participant, router]);

  useEffect(() => {
    if (!participant) {
      return;
    }

    const timer = window.setTimeout(() => void refresh(), 0);
    const supabase = createBrowserClient();
    if (!supabase) return () => window.clearTimeout(timer);

    const channel = supabase
      .channel(`play-${gameId}-${participant.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "games", filter: `id=eq.${gameId}` }, () => void refresh())
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
      abortRef.current?.abort();
      window.clearTimeout(timer);
    };
  }, [participant, gameId, refresh]);

  const countdown = useGameCountdown({
    questionId: question?.question?.id,
    startsAt: question?.questionStartsAt,
    endsAt: question?.questionEndsAt,
    timeLimitSeconds: question?.question?.time_limit,
    serverOffsetMs: questionClock.questionId === question?.question?.id ? questionClock.offsetMs : 0,
    graceMs: ANSWER_NETWORK_GRACE_MS,
  });
  const remaining = countdown.phase === "idle" ? (question?.question?.time_limit ?? 0) : countdown.remaining;
  const isAnswerOpen = countdown.phase === "active";

  useEffect(() => {
    if (gameState?.status !== "QUESTION" || !countdown.closeAtLocalMs) return;
    const delayMs = Math.max(0, countdown.closeAtLocalMs + 250 - Date.now());
    const timer = window.setTimeout(() => {
      void refresh();
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [countdown.closeAtLocalMs, gameState?.status, refresh]);

  async function submit(answerId: string) {
    if (!participant || selected || submitted || !isAnswerOpen) return;

    const submittedQuestionId = question?.question?.id;
    if (!submittedQuestionId) return;
    selectedRef.current = answerId;
    submittedRef.current = true;
    setSelected(answerId);
    setSubmitted(true);
    setSubmitError("");
    const response = await fetch(`/api/games/${gameId}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantId: participant.id, answerId }),
    });

    if (currentQuestionIdRef.current !== submittedQuestionId) return;
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setSubmitError(body?.error || "답안을 제출하지 못했습니다.");
      selectedRef.current = "";
      submittedRef.current = false;
      setSelected("");
      setSubmitted(false);
      return;
    }

    setSubmitted(true);
  }

  if (!participant) {
    return <Centered title="참가자 정보를 찾을 수 없습니다." body="처음 화면에서 PIN과 닉네임을 다시 입력하세요." />;
  }

  if (!gameState) {
    return <Centered title="연결 중..." body="현재 게임 상태를 불러오는 중입니다." />;
  }

  if (gameState.status === "LOBBY") {
    return <Centered title="입장 완료!" body={`${participant.nickname}님, 출제자가 게임을 시작할 때까지 기다려 주세요.`} />;
  }

  if (gameState.status === "QUESTION_RESULT") {
    return <Centered title="문제 종료!" body={`${participant.nickname}님, 다음 문제를 기다려주세요.`} />;
  }

  if (gameState.status === "QUESTION" && submitted) {
    return (
      <Centered
        title="답변 완료!"
        body={`다음 화면을 기다려주세요.${remaining > 0 ? ` 문제 마감까지 ${remaining}초 남았습니다.` : ""}`}
      />
    );
  }

  if (gameState.status === "QUESTION" && question && (countdown.phase === "preparing" || countdown.phase === "idle")) {
    return <Centered title="문제 준비 중..." body={`잠시 후 응답이 시작됩니다. 제한시간은 ${remaining}초입니다.`} />;
  }

  if (gameState.status === "QUESTION" && question && !isAnswerOpen) {
    return <Centered title="답변 마감" body="답변을 집계하고 있습니다. 잠시만 기다려 주세요." />;
  }

  return (
    <main className="min-h-screen overflow-hidden px-3 py-3">
      <section className="mx-auto flex h-[calc(100vh-24px)] max-w-xl flex-col gap-3">
        <div className="flex flex-[0_0_auto] items-center justify-center rounded-[8px] bg-white/90 px-4 py-2 text-sm font-black shadow-sm">
          <Clock className="mr-1" size={16} aria-hidden />
          남은 시간 {remaining}초
        </div>
        <AnswerGrid
          answers={question?.question?.answers ?? []}
          className="min-h-0"
          disabled={Boolean(selected) || !isAnswerOpen}
          mode="participant"
          onAnswer={submit}
          selectedId={selected}
        />
        {submitError ? <p className="pb-1 text-center text-sm font-black text-red-600">{submitError}</p> : null}
      </section>
    </main>
  );
}

function Centered({ title, body }: { title: string; body: string }) {
  return (
    <main className="grid min-h-screen place-items-center px-5 text-center">
      <div className="max-w-md rounded-[8px] border border-black/10 bg-white p-8 shadow-xl">
        {title.includes("완료") || title.includes("종료") ? (
          <CheckCircle2 className="mx-auto text-[#20c997]" size={42} aria-hidden />
        ) : (
          <Hourglass className="mx-auto text-[#5c7cfa]" size={42} aria-hidden />
        )}
        <h1 className="mt-4 text-3xl font-black">{title}</h1>
        <p className="mt-3 font-semibold leading-7 text-black/60">{body}</p>
      </div>
    </main>
  );
}
