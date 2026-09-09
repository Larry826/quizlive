"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, Hourglass } from "lucide-react";
import { AnswerGrid } from "@/components/game/answer-grid";
import { createBrowserClient } from "@/lib/supabase/browser";

type Participant = { id: string; nickname: string; score: number };
type Snapshot = {
  game: {
    id: string;
    pin: string;
    status: string;
    current_question_index: number;
    question_started_at: string | null;
    question_ends_at: string | null;
    quizzes: { title: string; questions: { id: string }[] };
  };
  participantCount: number;
};
type QuestionPayload = {
  status: string;
  questionStartedAt: string | null;
  questionEndsAt: string | null;
  submittedAnswerId: string | null;
  question: {
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
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [question, setQuestion] = useState<QuestionPayload | null>(null);
  const [selected, setSelected] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [now, setNow] = useState(0);
  const questionKey = question?.question.id ?? "none";

  const refresh = useCallback(async () => {
    const snapshotResponse = await fetch(`/api/games/${gameId}/snapshot`);
    if (!snapshotResponse.ok) return;

    const nextSnapshot = (await snapshotResponse.json()) as Snapshot;
    setSnapshot(nextSnapshot);

    if (nextSnapshot.game.status === "QUESTION") {
      const questionResponse = await fetch(`/api/games/${gameId}/question?participantId=${participant?.id ?? ""}`);
      if (questionResponse.ok) {
        const payload = (await questionResponse.json()) as QuestionPayload;
        setQuestion(payload);
        if (payload.submittedAnswerId) {
          setSelected(payload.submittedAnswerId);
          setSubmitted(true);
        }
      }
    }

    if (nextSnapshot.game.status === "FINISHED") {
      router.push(`/results/${gameId}`);
    }
  }, [gameId, participant?.id, router]);

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
      .on("postgres_changes", { event: "*", schema: "public", table: "participant_answers", filter: `participant_id=eq.${participant.id}` }, () => void refresh())
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
      window.clearTimeout(timer);
    };
  }, [participant, gameId, refresh]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSelected(question?.submittedAnswerId ?? "");
      setSubmitted(Boolean(question?.submittedAnswerId));
      setSubmitError("");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [question?.submittedAnswerId, questionKey]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  const remaining = useMemo(() => {
    if (!question?.questionEndsAt || !now) return question?.question.time_limit ?? 0;
    return Math.max(0, Math.ceil((new Date(question.questionEndsAt).getTime() - now) / 1000));
  }, [question, now]);

  useEffect(() => {
    if (snapshot?.game.status !== "QUESTION" || remaining > 0) return;
    const timer = window.setTimeout(() => {
      void refresh();
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [refresh, remaining, snapshot?.game.status]);

  async function submit(answerId: string) {
    if (!participant || selected || submitted) return;

    setSelected(answerId);
    setSubmitError("");
    const response = await fetch(`/api/games/${gameId}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantId: participant.id, answerId }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setSubmitError(body?.error || "답안을 제출하지 못했습니다.");
      setSelected("");
      setSubmitted(false);
      return;
    }

    setSubmitted(true);
  }

  if (!participant) {
    return <Centered title="참가자 정보를 찾을 수 없습니다." body="처음 화면에서 PIN과 닉네임을 다시 입력하세요." />;
  }

  if (!snapshot) {
    return <Centered title="연결 중..." body="현재 게임 상태를 불러오는 중입니다." />;
  }

  if (snapshot.game.status === "LOBBY") {
    return <Centered title="입장 완료!" body={`${participant.nickname}님, 출제자가 게임을 시작할 때까지 기다려 주세요.`} />;
  }

  if (snapshot.game.status === "QUESTION_RESULT") {
    return <Centered title="문제 종료!" body={`${participant.nickname}님, 다음 문제를 기다려주세요.`} />;
  }

  if (snapshot.game.status === "QUESTION" && submitted) {
    return (
      <Centered
        title="답변 완료!"
        body={`다음 화면을 기다려주세요.${remaining > 0 ? ` 문제 마감까지 ${remaining}초 남았습니다.` : ""}`}
      />
    );
  }

  return (
    <main className="min-h-screen overflow-hidden px-3 py-3">
      <section className="mx-auto flex h-[calc(100vh-24px)] max-w-xl flex-col gap-3">
        <div className="flex flex-[0_0_auto] items-center justify-center rounded-[8px] bg-white/90 px-4 py-2 text-sm font-black shadow-sm">
          <Clock className="mr-1" size={16} aria-hidden />
          남은 시간 {remaining}초
        </div>
        <AnswerGrid
          answers={question?.question.answers ?? []}
          className="min-h-0"
          disabled={Boolean(selected) || remaining === 0}
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
