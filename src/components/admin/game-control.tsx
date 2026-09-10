"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { CheckCircle2, QrCode, StepForward, Users, X } from "lucide-react";
import { AnswerGrid } from "@/components/game/answer-grid";
import { ANSWER_LABELS, ANSWER_NETWORK_GRACE_MS } from "@/lib/game/constants";
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
  participantCount: number;
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

export function GameControl({ gameId }: { gameId: string }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [question, setQuestion] = useState<QuestionPayload | null>(null);
  const [result, setResult] = useState<ResultPayload | null>(null);
  const [qr, setQr] = useState("");
  const [message, setMessage] = useState("");
  const [showCumulative, setShowCumulative] = useState(false);
  const [now, setNow] = useState(0);
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const refreshTimerRef = useRef<number | null>(null);

  const joinUrl = useMemo(() => {
    if (typeof window === "undefined" || !snapshot) return "";
    const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
    return `${configuredUrl || window.location.origin}/join?pin=${snapshot.game.pin}`;
  }, [snapshot]);

  const syncServerClock = useCallback((serverNow: string | null | undefined) => {
    if (!serverNow) return;
    const serverNowMs = new Date(serverNow).getTime();
    if (Number.isFinite(serverNowMs)) {
      setServerOffsetMs(serverNowMs - Date.now());
    }
  }, []);

  const refresh = useCallback(async () => {
    const [snapshotResponse, participantsResponse, questionResponse, resultResponse] = await Promise.all([
      fetch(`/api/games/${gameId}/snapshot`),
      fetch(`/api/games/${gameId}/participants`),
      fetch(`/api/games/${gameId}/host-question`).catch(() => null),
      fetch(`/api/games/${gameId}/result`).catch(() => null),
    ]);

    if (snapshotResponse.ok) {
      const body = (await snapshotResponse.json()) as Snapshot;
      syncServerClock(body.serverNow);
      setSnapshot(body);
    }
    if (participantsResponse.ok) {
      const body = (await participantsResponse.json()) as { participants: Participant[] };
      setParticipants(body.participants);
    }
    if (questionResponse?.ok) {
      const body = (await questionResponse.json()) as QuestionPayload;
      syncServerClock(body.serverNow);
      setQuestion(body);
    }
    if (resultResponse?.ok) setResult((await resultResponse.json()) as ResultPayload);
  }, [gameId, syncServerClock]);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      window.clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;
      void refresh();
    }, 150);
  }, [refresh]);

  useEffect(() => {
    scheduleRefresh();
    const supabase = createBrowserClient();
    if (!supabase) {
      return () => {
        if (refreshTimerRef.current) {
          window.clearTimeout(refreshTimerRef.current);
          refreshTimerRef.current = null;
        }
      };
    }

    const channel = supabase
      .channel(`admin-game-${gameId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "games", filter: `id=eq.${gameId}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "participants", filter: `game_id=eq.${gameId}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "participant_answers", filter: `game_id=eq.${gameId}` }, scheduleRefresh)
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [gameId, scheduleRefresh]);

  useEffect(() => {
    if (joinUrl) void QRCode.toDataURL(joinUrl, { margin: 1, width: 220 }).then(setQr);
  }, [joinUrl]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  const remaining = useMemo(() => {
    const endsAt = question?.questionEndsAt ?? snapshot?.game.question_ends_at;
    const startsAt = question?.questionStartsAt ?? snapshot?.game.question_starts_at;
    const effectiveNow = now + serverOffsetMs;
    if (!endsAt || !effectiveNow) return question?.question.time_limit ?? 0;
    if (startsAt && new Date(startsAt).getTime() > effectiveNow) {
      return question?.question.time_limit ?? 0;
    }
    return Math.max(0, Math.ceil((new Date(endsAt).getTime() - effectiveNow) / 1000));
  }, [now, question, serverOffsetMs, snapshot?.game.question_ends_at, snapshot?.game.question_starts_at]);

  const settleDelayMs = useMemo(() => {
    const endsAt = question?.questionEndsAt ?? snapshot?.game.question_ends_at;
    if (!endsAt || !now) return ANSWER_NETWORK_GRACE_MS;
    const effectiveNow = now + serverOffsetMs;
    return Math.max(0, new Date(endsAt).getTime() + ANSWER_NETWORK_GRACE_MS - effectiveNow);
  }, [now, question?.questionEndsAt, serverOffsetMs, snapshot?.game.question_ends_at]);

  useEffect(() => {
    if (snapshot?.game.status !== "QUESTION" || remaining > 0) return;
    const timer = window.setTimeout(() => {
      void fetch(`/api/games/${gameId}/auto-close`, { method: "POST" }).then(() => refresh());
    }, settleDelayMs + 50);
    return () => window.clearTimeout(timer);
  }, [gameId, refresh, remaining, settleDelayMs, snapshot?.game.status]);

  async function command(path: string) {
    setMessage("");
    const response = await fetch(path, { method: "POST" });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessage(body?.error || "요청을 처리하지 못했습니다.");
    }
    await refresh();
  }

  const status = snapshot?.game.status ?? "LOADING";
  const questionCount = snapshot?.game.quizzes.questions.length ?? result?.totalQuestions ?? 0;
  const submittedCount = result?.submittedCount ?? 0;
  const participantCount = result?.participantCount ?? participants.length;

  if (status === "QUESTION") {
    return (
      <QuestionPresenterView
        onEnd={() => void command(`/api/games/${gameId}/end-question`)}
        participantCount={participantCount}
        question={question}
        questionCount={questionCount}
        questionIndex={snapshot?.game.current_question_index ?? 0}
        remaining={remaining}
        settling={remaining === 0}
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
  remaining,
  settling,
  submittedCount,
}: {
  onEnd: () => void;
  participantCount: number;
  question: QuestionPayload | null;
  questionCount: number;
  questionIndex: number;
  remaining: number;
  settling: boolean;
  submittedCount: number;
}) {
  return (
    <main className="fixed inset-0 z-50 flex h-screen max-h-screen flex-col overflow-hidden bg-[#f7f3ec] p-[clamp(0.5rem,1.4vh,1rem)]">
      <header className="grid min-h-0 grid-cols-3 items-center gap-3 rounded-[8px] bg-white px-[clamp(0.75rem,1.4vw,1.5rem)] py-[clamp(0.45rem,1vh,0.8rem)] shadow-sm">
        <div className="text-[clamp(1rem,2.4vh,1.8rem)] font-black">문제 {questionIndex + 1} / {questionCount}</div>
        <div className="text-center text-[clamp(1rem,2.4vh,1.8rem)] font-black">답변 {submittedCount} / {participantCount}</div>
        <div className="text-right text-[clamp(1.1rem,3.2vh,2.4rem)] font-black">
          {settling ? "응답 집계 중..." : `남은 시간 ${remaining}초`}
        </div>
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
