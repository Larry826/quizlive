"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { CheckCircle2, QrCode, StepForward, Users, X } from "lucide-react";
import { AnswerGrid } from "@/components/game/answer-grid";
import { useGameCountdown } from "@/hooks/use-game-countdown";
import { ANSWER_LABELS, ANSWER_NETWORK_GRACE_MS } from "@/lib/game/constants";
import { estimateServerOffsetMs, shouldApplyResponse } from "@/lib/game/countdown.mjs";
import { createBrowserClient } from "@/lib/supabase/browser";

type Participant = { id: string; nickname: string; score: number };
type Snapshot = {
  game: {
    id: string;
    pin: string;
    status: string;
    current_question_index: number;
    question_started_at: string | null;
    question_starts_at: string | null;
    question_ends_at: string | null;
    quizzes: { title: string; questions: { id: string }[] };
  };
  serverNow: string;
};
type QuestionPayload = {
  status: string;
  questionStartedAt: string | null;
  questionStartsAt: string | null;
  questionEndsAt: string | null;
  serverNow: string;
  question: {
    id: string;
    order_index: number;
    question_text: string;
    time_limit: number;
    answers: { id: string; answer_text: string; answer_index: number }[];
  };
};
type ResultPayload = {
  status: string;
  question: { id: string; orderIndex: number; text: string; timeLimit: number };
  answers: { id: string; answerIndex: number; text: string; isCorrect: boolean; count: number }[];
  submittedCount: number;
  participantCount: number;
  totalQuestions: number;
  isLastQuestion: boolean;
  questionTop5: { rank: number; nickname: string; scoreAwarded: number }[];
  cumulativeTop5: { rank: number; nickname: string; score: number }[];
};
type CommandPayload = {
  snapshot?: Snapshot;
  question?: QuestionPayload | null;
  serverNow?: string;
};

export function GameControl({ gameId }: { gameId: string }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [question, setQuestion] = useState<QuestionPayload | null>(null);
  const [result, setResult] = useState<ResultPayload | null>(null);
  const [qr, setQr] = useState("");
  const [message, setMessage] = useState("");
  const [showCumulative, setShowCumulative] = useState(false);
  const [submittedCount, setSubmittedCount] = useState(0);
  const [questionClock, setQuestionClock] = useState({ questionId: "", offsetMs: 0 });
  const snapshotRef = useRef<Snapshot | null>(null);
  const questionRef = useRef<QuestionPayload | null>(null);
  const gameRefreshTimerRef = useRef<number | null>(null);
  const participantRefreshTimerRef = useRef<number | null>(null);
  const answerCountRefreshTimerRef = useRef<number | null>(null);
  const latestSnapshotRequestRef = useRef(0);
  const latestParticipantRequestRef = useRef(0);
  const latestQuestionRequestRef = useRef(0);
  const latestResultRequestRef = useRef(0);
  const latestAnswerCountRequestRef = useRef(0);
  const autoCloseQuestionRef = useRef("");
  const loadedResultIndexRef = useRef<number | null>(null);
  const resultInFlightRef = useRef<{ index: number; promise: Promise<void> } | null>(null);

  const joinUrl = useMemo(() => {
    if (typeof window === "undefined" || !snapshot) return "";
    const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
    return `${configuredUrl || window.location.origin}/join?pin=${snapshot.game.pin}`;
  }, [snapshot]);

  const applySnapshot = useCallback((nextSnapshot: Snapshot) => {
    snapshotRef.current = nextSnapshot;
    setSnapshot(nextSnapshot);
  }, []);

  const applyQuestion = useCallback((payload: QuestionPayload, offsetMs: number) => {
    const questionId = payload.question.id;
    if (questionRef.current?.question.id === questionId) return;
    questionRef.current = payload;
    setQuestion(payload);
    setQuestionClock({ questionId, offsetMs });
    setSubmittedCount(0);
    autoCloseQuestionRef.current = "";
  }, []);

  const loadParticipants = useCallback(async () => {
    const requestId = ++latestParticipantRequestRef.current;
    const response = await fetch(`/api/games/${gameId}/participants`, { cache: "no-store" });
    if (!response.ok || !shouldApplyResponse(requestId, latestParticipantRequestRef.current)) return;
    const body = (await response.json()) as { participants: Participant[] };
    if (shouldApplyResponse(requestId, latestParticipantRequestRef.current)) setParticipants(body.participants);
  }, [gameId]);

  const loadAnswerCount = useCallback(async (questionId: string) => {
    const requestId = ++latestAnswerCountRequestRef.current;
    const response = await fetch(
      `/api/games/${gameId}/answer-count?questionId=${encodeURIComponent(questionId)}`,
      { cache: "no-store" },
    );
    if (!response.ok || !shouldApplyResponse(requestId, latestAnswerCountRequestRef.current)) return;
    const body = (await response.json()) as { questionId: string; submittedCount: number };
    if (
      shouldApplyResponse(requestId, latestAnswerCountRequestRef.current) &&
      questionRef.current?.question.id === body.questionId
    ) {
      setSubmittedCount(body.submittedCount);
    }
  }, [gameId]);

  const loadQuestion = useCallback(async () => {
    const requestId = ++latestQuestionRequestRef.current;
    const requestStartedAt = performance.now();
    const response = await fetch(`/api/games/${gameId}/host-question`, { cache: "no-store" });
    const requestEndedAt = performance.now();
    if (!response.ok || !shouldApplyResponse(requestId, latestQuestionRequestRef.current)) return;
    const payload = (await response.json()) as QuestionPayload;
    if (!shouldApplyResponse(requestId, latestQuestionRequestRef.current)) return;
    const offsetMs = estimateServerOffsetMs(payload.serverNow, requestEndedAt - requestStartedAt, Date.now());
    applyQuestion(payload, offsetMs);
    void loadAnswerCount(payload.question.id);
  }, [applyQuestion, gameId, loadAnswerCount]);

  const loadResult = useCallback(() => {
    const questionIndex = snapshotRef.current?.game.current_question_index;
    if (questionIndex === undefined || loadedResultIndexRef.current === questionIndex) return Promise.resolve();
    if (resultInFlightRef.current?.index === questionIndex) return resultInFlightRef.current.promise;

    const requestId = ++latestResultRequestRef.current;
    const promise = (async () => {
      const response = await fetch(`/api/games/${gameId}/result`, { cache: "no-store" });
      if (!response.ok || !shouldApplyResponse(requestId, latestResultRequestRef.current)) return;
      const payload = (await response.json()) as ResultPayload;
      if (shouldApplyResponse(requestId, latestResultRequestRef.current)) {
        loadedResultIndexRef.current = payload.question.orderIndex;
        setResult(payload);
        setSubmittedCount(payload.submittedCount);
      }
    })();
    resultInFlightRef.current = { index: questionIndex, promise };
    void promise.finally(() => {
      if (resultInFlightRef.current?.promise === promise) resultInFlightRef.current = null;
    });
    return promise;
  }, [gameId]);

  const refreshState = useCallback(async () => {
    const requestId = ++latestSnapshotRequestRef.current;
    const response = await fetch(`/api/games/${gameId}/snapshot`, { cache: "no-store" });
    if (!response.ok || !shouldApplyResponse(requestId, latestSnapshotRequestRef.current)) return;
    const nextSnapshot = (await response.json()) as Snapshot;
    if (!shouldApplyResponse(requestId, latestSnapshotRequestRef.current)) return;
    applySnapshot(nextSnapshot);

    if (nextSnapshot.game.status === "QUESTION") {
      if (questionRef.current?.question.order_index !== nextSnapshot.game.current_question_index) {
        await loadQuestion();
      }
    } else if (nextSnapshot.game.status === "QUESTION_RESULT" || nextSnapshot.game.status === "FINISHED") {
      await loadResult();
    }
  }, [applySnapshot, gameId, loadQuestion, loadResult]);

  const scheduleGameRefresh = useCallback(() => {
    if (gameRefreshTimerRef.current !== null) return;
    gameRefreshTimerRef.current = window.setTimeout(() => {
      gameRefreshTimerRef.current = null;
      void refreshState();
    }, 80);
  }, [refreshState]);

  const scheduleParticipantRefresh = useCallback(() => {
    if (snapshotRef.current?.game.status !== "LOBBY" || participantRefreshTimerRef.current !== null) return;
    participantRefreshTimerRef.current = window.setTimeout(() => {
      participantRefreshTimerRef.current = null;
      void loadParticipants();
    }, 100);
  }, [loadParticipants]);

  const scheduleAnswerCountRefresh = useCallback(() => {
    if (snapshotRef.current?.game.status !== "QUESTION" || answerCountRefreshTimerRef.current !== null) return;
    answerCountRefreshTimerRef.current = window.setTimeout(() => {
      answerCountRefreshTimerRef.current = null;
      const questionId = questionRef.current?.question.id;
      if (questionId) void loadAnswerCount(questionId);
    }, 120);
  }, [loadAnswerCount]);

  useEffect(() => {
    void Promise.all([refreshState(), loadParticipants()]);
    const supabase = createBrowserClient();
    if (!supabase) return;

    const channel = supabase
      .channel(`admin-game-${gameId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "games", filter: `id=eq.${gameId}` }, scheduleGameRefresh)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "participants", filter: `game_id=eq.${gameId}` }, scheduleParticipantRefresh)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "participant_answers", filter: `game_id=eq.${gameId}` }, scheduleAnswerCountRefresh)
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
      for (const timerRef of [gameRefreshTimerRef, participantRefreshTimerRef, answerCountRefreshTimerRef]) {
        if (timerRef.current !== null) window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [gameId, loadParticipants, refreshState, scheduleAnswerCountRefresh, scheduleGameRefresh, scheduleParticipantRefresh]);

  useEffect(() => {
    if (joinUrl) void QRCode.toDataURL(joinUrl, { margin: 1, width: 220 }).then(setQr);
  }, [joinUrl]);

  const countdown = useGameCountdown({
    questionId: question?.question.id,
    startsAt: question?.questionStartsAt,
    endsAt: question?.questionEndsAt,
    timeLimitSeconds: question?.question.time_limit,
    serverOffsetMs: questionClock.questionId === question?.question.id ? questionClock.offsetMs : 0,
    graceMs: ANSWER_NETWORK_GRACE_MS,
  });

  useEffect(() => {
    const questionId = question?.question.id;
    if (snapshot?.game.status !== "QUESTION" || !questionId || !countdown.closeAtLocalMs) return;
    let cancelled = false;
    let retryTimer: number | null = null;

    const close = async () => {
      if (cancelled || autoCloseQuestionRef.current === questionId) return;
      const response = await fetch(`/api/games/${gameId}/auto-close`, { method: "POST" });
      const body = (await response.json().catch(() => null)) as { closed?: boolean; reason?: string } | null;
      if (cancelled || !response.ok) return;
      if (!body?.closed && body?.reason === "not_ready") {
        retryTimer = window.setTimeout(() => void close(), 200);
        return;
      }
      autoCloseQuestionRef.current = questionId;
      const current = snapshotRef.current;
      if (current) {
        latestSnapshotRequestRef.current += 1;
        applySnapshot({ ...current, game: { ...current.game, status: "QUESTION_RESULT" } });
      }
      await loadResult();
    };

    const delayMs = Math.max(0, countdown.closeAtLocalMs + 75 - Date.now());
    const timer = window.setTimeout(() => void close(), delayMs);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (retryTimer !== null) window.clearTimeout(retryTimer);
    };
  }, [applySnapshot, countdown.closeAtLocalMs, gameId, loadResult, question?.question.id, snapshot?.game.status]);

  async function command(path: string) {
    setMessage("");
    const requestStartedAt = performance.now();
    const response = await fetch(path, { method: "POST" });
    const requestEndedAt = performance.now();
    const body = (await response.json().catch(() => null)) as (CommandPayload & { error?: string }) | null;
    if (!response.ok) {
      setMessage(body?.error || "요청을 처리하지 못했습니다.");
      return;
    }
    latestSnapshotRequestRef.current += 1;
    latestQuestionRequestRef.current += 1;
    latestResultRequestRef.current += 1;
    if (body?.snapshot) applySnapshot(body.snapshot);
    if (body?.question) {
      const offsetMs = estimateServerOffsetMs(
        body.serverNow ?? body.question.serverNow,
        requestEndedAt - requestStartedAt,
        Date.now(),
      );
      applyQuestion(body.question, offsetMs);
      return;
    }
    if (path.endsWith("/end-question")) {
      const current = snapshotRef.current;
      if (current) applySnapshot({ ...current, game: { ...current.game, status: "QUESTION_RESULT" } });
      await loadResult();
    }
  }

  const status = snapshot?.game.status ?? "LOADING";
  const questionCount = snapshot?.game.quizzes.questions.length ?? result?.totalQuestions ?? 0;
  const participantCount = participants.length || result?.participantCount || 0;

  if (status === "QUESTION") {
    return (
      <QuestionPresenterView
        onEnd={() => void command(`/api/games/${gameId}/end-question`)}
        participantCount={participantCount}
        question={question}
        questionCount={questionCount}
        questionIndex={snapshot?.game.current_question_index ?? 0}
        phase={countdown.phase}
        remaining={countdown.remaining}
        submittedCount={submittedCount}
      />
    );
  }

  return (
    <div className="grid min-h-[calc(100vh-40px)] gap-4 lg:grid-cols-[1fr_340px]">
      <section className="rounded-[8px] border border-black/10 bg-white p-6 shadow-sm">
        <Header snapshot={snapshot} status={status} />
        {status === "LOBBY" ? (
          <LobbyView
            joinUrl={joinUrl}
            onStart={() => void command(`/api/games/${gameId}/start`)}
            participants={participants}
            qr={qr}
          />
        ) : status === "QUESTION_RESULT" ? (
          <ResultView
            gameId={gameId}
            onCommand={command}
            onShowCumulative={() => setShowCumulative(true)}
            result={result}
          />
        ) : status === "FINISHED" ? (
          <FinalView result={result} />
        ) : null}
        {message ? <p className="mt-4 font-bold text-red-600">{message}</p> : null}
      </section>

      <aside className="space-y-4">
        {status === "LOBBY" ? (
          <ParticipantsPanel participants={participants} />
        ) : status === "QUESTION_RESULT" ? (
          <QuestionTopPanel result={result} />
        ) : (
          <FinalTopPanel result={result} />
        )}
      </aside>

      {showCumulative ? <CumulativeModal onClose={() => setShowCumulative(false)} result={result} /> : null}
    </div>
  );
}

function QuestionPresenterView({
  onEnd,
  participantCount,
  question,
  questionCount,
  questionIndex,
  phase,
  remaining,
  submittedCount,
}: {
  onEnd: () => void;
  participantCount: number;
  question: QuestionPayload | null;
  questionCount: number;
  questionIndex: number;
  phase: "idle" | "preparing" | "active" | "settling" | "closed";
  remaining: number;
  submittedCount: number;
}) {
  const timerLabel =
    phase === "preparing" || phase === "idle"
      ? "준비"
      : phase === "active"
        ? `남은 시간 ${remaining}초`
        : "응답 집계 중...";

  return (
    <main className="fixed inset-0 z-50 flex h-screen max-h-screen flex-col overflow-hidden bg-[#f7f3ec] p-[clamp(0.5rem,1.4vh,1rem)]">
      <header className="grid min-h-0 grid-cols-3 items-center gap-3 rounded-[8px] bg-white px-[clamp(0.75rem,1.4vw,1.5rem)] py-[clamp(0.45rem,1vh,0.8rem)] shadow-sm">
        <div className="text-[clamp(1rem,2.4vh,1.8rem)] font-black">문제 {questionIndex + 1} / {questionCount}</div>
        <div className="text-center text-[clamp(1rem,2.4vh,1.8rem)] font-black">답변 {submittedCount} / {participantCount}</div>
        <div className="text-right text-[clamp(1.1rem,3.2vh,2.4rem)] font-black">{timerLabel}</div>
      </header>

      <section className="grid min-h-0 flex-[0_0_16vh] place-items-center px-[clamp(0.5rem,1vw,1rem)] py-[clamp(0.35rem,1vh,0.75rem)]">
        <h1 className="max-h-full overflow-hidden text-center text-[clamp(1.45rem,5vh,4rem)] font-black leading-tight">
          {question?.question.question_text}
        </h1>
      </section>

      <AnswerGrid answers={question?.question.answers ?? []} className="min-h-0 flex-1" mode="host" />

      <footer className="mt-[clamp(0.35rem,1vh,0.75rem)] flex flex-[0_0_auto] justify-end">
        <button
          className="focus-ring rounded-[8px] bg-[#ff6b6b] px-[clamp(1rem,2vw,1.5rem)] py-[clamp(0.55rem,1.2vh,0.9rem)] text-[clamp(0.9rem,2vh,1.2rem)] font-black text-white"
          onClick={onEnd}
          type="button"
        >
          문제 종료
        </button>
      </footer>
    </main>
  );
}

function Header({ snapshot, status }: { snapshot: Snapshot | null; status: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-sm font-black text-black/50">PIN</p>
        <h1 className="font-mono text-6xl font-black tracking-[0.12em]">{snapshot?.game.pin}</h1>
        <p className="mt-3 text-2xl font-black">{snapshot?.game.quizzes.title}</p>
      </div>
      <div className="rounded-[8px] bg-[#20c997] px-4 py-2 font-black text-[#06281f]">{status}</div>
    </div>
  );
}

function LobbyView({
  joinUrl,
  onStart,
  participants,
  qr,
}: {
  joinUrl: string;
  onStart: () => void;
  participants: Participant[];
  qr: string;
}) {
  return (
    <div className="mt-10 grid gap-6 md:grid-cols-[240px_1fr]">
      <div className="rounded-[8px] border border-black/10 bg-[#f8fafc] p-4">
        <div className="mb-3 flex items-center gap-2 font-black">
          <QrCode size={18} aria-hidden />
          QR 입장
        </div>
        {qr ? <Image alt="참가 QR 코드" className="h-56 w-56" height={224} src={qr} unoptimized width={224} /> : null}
      </div>
      <div>
        <h2 className="text-3xl font-black">참가자를 기다리는 중</h2>
        <p className="mt-2 break-all font-semibold text-black/55">{joinUrl}</p>
        <button
          className="focus-ring mt-6 rounded-[8px] bg-[#141414] px-5 py-4 font-black text-white disabled:bg-black/30"
          disabled={participants.length === 0}
          onClick={onStart}
          type="button"
        >
          게임 시작
        </button>
      </div>
    </div>
  );
}

function ResultView({
  gameId,
  onCommand,
  onShowCumulative,
  result,
}: {
  gameId: string;
  onCommand: (path: string) => Promise<void>;
  onShowCumulative: () => void;
  result: ResultPayload | null;
}) {
  if (!result) return <div className="mt-8 text-xl font-black">문제 결과를 불러오는 중입니다.</div>;
  const maxCount = Math.max(1, ...result.answers.map((answer) => answer.count));

  return (
    <div className="mt-8">
      <div className="text-sm font-black text-black/55">문제 {result.question.orderIndex + 1} / {result.totalQuestions}</div>
      <h2 className="mt-3 text-4xl font-black leading-tight">Q. {result.question.text}</h2>
      <div className="mt-6 grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <section className="rounded-[8px] border border-black/10 bg-[#f8fafc] p-5">
          <h3 className="text-2xl font-black">응답 결과</h3>
          <div className="mt-4 space-y-3">
            {result.answers
              .slice()
              .sort((a, b) => a.answerIndex - b.answerIndex)
              .map((answer) => (
                <div
                  className={`rounded-[8px] border-2 p-4 ${answer.isCorrect ? "border-[#20c997] bg-[#e8fff7]" : "border-black/10 bg-white"}`}
                  key={answer.id}
                >
                  <div className="flex items-center justify-between gap-3 text-xl font-black">
                    <span>
                      {answer.isCorrect ? (
                        <span className="mr-2 inline-flex items-center gap-1 rounded-[8px] bg-[#20c997] px-2 py-1 text-sm text-[#06281f]">
                          <CheckCircle2 size={16} aria-hidden />
                          정답
                        </span>
                      ) : null}
                      {ANSWER_LABELS[answer.answerIndex]}. {answer.text}
                    </span>
                    <span>{answer.count}명</span>
                  </div>
                  <div className="mt-3 h-3 overflow-hidden rounded-full bg-black/10">
                    <div className="h-full rounded-full bg-[#141414]" style={{ width: `${Math.round((answer.count / maxCount) * 100)}%` }} />
                  </div>
                </div>
              ))}
          </div>
          <p className="mt-4 text-lg font-black text-black/60">총 응답 {result.submittedCount}명 / 참가자 {result.participantCount}명</p>
        </section>
        <QuestionTopPanel result={result} />
      </div>
      <div className="mt-6 flex flex-wrap justify-between gap-3">
        <button className="focus-ring rounded-[8px] border border-black/15 bg-white px-5 py-3 font-black" onClick={onShowCumulative} type="button">
          누적 등수 확인
        </button>
        <button
          className="focus-ring inline-flex items-center gap-2 rounded-[8px] bg-[#141414] px-5 py-3 font-black text-white"
          onClick={() => void onCommand(`/api/games/${gameId}/next`)}
          type="button"
        >
          <StepForward size={18} aria-hidden />
          {result.isLastQuestion ? "최종 결과" : "다음 문제"}
        </button>
      </div>
    </div>
  );
}

function ParticipantsPanel({ participants }: { participants: Participant[] }) {
  return (
    <div className="rounded-[8px] border border-black/10 bg-white p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-xl font-black">
        <Users size={20} aria-hidden /> 참가자 {participants.length}명
      </h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {participants.map((participant) => (
          <span className="rounded-[8px] bg-[#f1f5f9] px-3 py-2 text-sm font-black" key={participant.id}>
            {participant.nickname}
          </span>
        ))}
      </div>
    </div>
  );
}

function QuestionTopPanel({ result }: { result: ResultPayload | null }) {
  return (
    <div className="rounded-[8px] border border-black/10 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-black">이번 문제 TOP 5</h2>
      <div className="mt-4 space-y-2">
        {result?.questionTop5.length ? (
          result.questionTop5.map((entry) => (
            <div className="flex items-center justify-between rounded-[8px] bg-[#f8fafc] px-3 py-3 font-black" key={`${entry.rank}-${entry.nickname}`}>
              <span>{entry.rank}. {entry.nickname}</span>
              <span>{entry.scoreAwarded.toLocaleString()}점</span>
            </div>
          ))
        ) : (
          <p className="rounded-[8px] bg-[#f8fafc] p-4 font-bold text-black/55">이번 문제 정답자가 없습니다.</p>
        )}
      </div>
    </div>
  );
}

function FinalTopPanel({ result }: { result: ResultPayload | null }) {
  return (
    <div className="rounded-[8px] border border-black/10 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-black">최종 TOP 5</h2>
      <div className="mt-4 space-y-2">
        {result?.cumulativeTop5.map((entry) => (
          <div className="flex items-center justify-between rounded-[8px] bg-[#f8fafc] px-3 py-3 font-black" key={`${entry.rank}-${entry.nickname}`}>
            <span>{entry.rank}. {entry.nickname}</span>
            <span>{entry.score.toLocaleString()}점</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FinalView({ result }: { result: ResultPayload | null }) {
  return (
    <div className="mt-10 text-center">
      <h2 className="text-5xl font-black">최종 결과</h2>
      <div className="mx-auto mt-8 max-w-xl space-y-3">
        {result?.cumulativeTop5.map((entry) => (
          <div
            className={`flex items-center justify-between rounded-[8px] px-5 py-4 font-black ${entry.rank <= 3 ? "bg-[#20c997] text-[#06281f]" : "bg-[#f8fafc]"}`}
            key={`${entry.rank}-${entry.nickname}`}
          >
            <span>{entry.rank}. {entry.nickname}</span>
            <span>{entry.score.toLocaleString()}점</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CumulativeModal({ onClose, result }: { onClose: () => void; result: ResultPayload | null }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4">
      <section className="w-full max-w-md rounded-[8px] bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-black">현재 누적 TOP 5</h2>
          <button className="focus-ring rounded-[8px] p-2 hover:bg-black/5" onClick={onClose} type="button" aria-label="닫기">
            <X size={20} aria-hidden />
          </button>
        </div>
        <div className="mt-5 space-y-2">
          {result?.cumulativeTop5.length ? (
            result.cumulativeTop5.map((entry) => (
              <div className="flex items-center justify-between rounded-[8px] bg-[#f8fafc] px-4 py-3 font-black" key={`${entry.rank}-${entry.nickname}`}>
                <span>{entry.rank}. {entry.nickname}</span>
                <span>{entry.score.toLocaleString()}점</span>
              </div>
            ))
          ) : (
            <p className="rounded-[8px] bg-[#f8fafc] p-4 font-bold text-black/55">아직 누적 점수가 없습니다.</p>
          )}
        </div>
        <button className="focus-ring mt-5 h-12 w-full rounded-[8px] bg-[#141414] font-black text-white" onClick={onClose} type="button">
          닫기
        </button>
      </section>
    </div>
  );
}
