"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Save, Sparkles, Trash2 } from "lucide-react";
import { ANSWER_LABELS } from "@/lib/game/constants";
import { createEmptyQuestion, createEmptyQuiz } from "@/lib/quiz/defaults";
import type { QuizInput } from "@/types/quiz";

const timeOptions = [5, 10, 15, 20, 30, 45, 60];

export function QuizForm({ initialQuiz, quizId }: { initialQuiz?: QuizInput; quizId?: string }) {
  const router = useRouter();
  const [quiz, setQuiz] = useState<QuizInput>(initialQuiz ?? createEmptyQuiz());
  const [saving, setSaving] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [error, setError] = useState("");

  async function saveQuiz(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const response = await fetch(quizId ? `/api/admin/quizzes/${quizId}` : "/api/admin/quizzes", {
      method: quizId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(quiz),
    });
    setSaving(false);
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error || "퀴즈를 저장하지 못했습니다.");
      return;
    }
    router.push("/admin/quizzes");
    router.refresh();
  }

  function updateQuestion(index: number, next: Partial<QuizInput["questions"][number]>) {
    setQuiz((current) => ({
      ...current,
      questions: current.questions.map((question, questionIndex) =>
        questionIndex === index ? { ...question, ...next } : question,
      ),
    }));
  }

  function setCorrect(questionIndex: number, answerIndex: number) {
    setQuiz((current) => ({
      ...current,
      questions: current.questions.map((question, index) =>
        index === questionIndex
          ? {
              ...question,
              answers: question.answers.map((answer, innerIndex) => ({
                ...answer,
                isCorrect: innerIndex === answerIndex,
              })),
            }
          : question,
      ),
    }));
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black">퀴즈 만들기</h1>
          <p className="mt-1 font-semibold text-black/55">직접 만들거나 AI 초안을 불러온 뒤 저장하세요.</p>
        </div>
        <button
          className="focus-ring inline-flex items-center gap-2 rounded-[8px] bg-[#20c997] px-4 py-3 font-black text-[#06281f]"
          onClick={() => setAiOpen(true)}
          type="button"
        >
          <Sparkles size={18} aria-hidden />
          AI로 생성
        </button>
      </div>

      <form className="space-y-5" onSubmit={saveQuiz}>
        <section className="rounded-[8px] border border-black/10 bg-white p-5 shadow-sm">
          <label className="block text-sm font-black text-black/60" htmlFor="title">
            퀴즈 제목
          </label>
          <input
            id="title"
            className="focus-ring mt-2 h-12 w-full rounded-[8px] border border-black/15 px-3"
            value={quiz.title}
            onChange={(event) => setQuiz({ ...quiz, title: event.target.value })}
          />
          <label className="mt-4 block text-sm font-black text-black/60" htmlFor="description">
            설명
          </label>
          <textarea
            id="description"
            className="focus-ring mt-2 min-h-24 w-full rounded-[8px] border border-black/15 p-3"
            value={quiz.description}
            onChange={(event) => setQuiz({ ...quiz, description: event.target.value })}
          />
        </section>

        {quiz.questions.map((question, questionIndex) => (
          <section
            className="rounded-[8px] border border-black/10 bg-white p-5 shadow-sm"
            key={questionIndex}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-black">문제 {questionIndex + 1}</h2>
              <button
                className="focus-ring inline-flex items-center gap-2 rounded-[8px] border border-red-200 px-3 py-2 text-sm font-bold text-red-700 disabled:opacity-40"
                disabled={quiz.questions.length === 1}
                onClick={() =>
                  setQuiz((current) => ({
                    ...current,
                    questions: current.questions.filter((_, index) => index !== questionIndex),
                  }))
                }
                type="button"
              >
                <Trash2 size={16} aria-hidden />
                삭제
              </button>
            </div>
            <textarea
              className="focus-ring mt-4 min-h-24 w-full rounded-[8px] border border-black/15 p-3 text-lg font-bold"
              placeholder="문제 내용을 입력하세요."
              value={question.text}
              onChange={(event) => updateQuestion(questionIndex, { text: event.target.value })}
            />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-black text-black/60">
                제한 시간
                <select
                  className="focus-ring mt-2 h-11 w-full rounded-[8px] border border-black/15 px-3"
                  value={question.timeLimit}
                  onChange={(event) => updateQuestion(questionIndex, { timeLimit: Number(event.target.value) })}
                >
                  {timeOptions.map((time) => (
                    <option key={time} value={time}>
                      {time}초
                    </option>
                  ))}
                </select>
              </label>
              <label className="mt-7 inline-flex items-center gap-2 text-sm font-black text-black/70">
                <input
                  checked={question.pointsEnabled}
                  onChange={(event) => updateQuestion(questionIndex, { pointsEnabled: event.target.checked })}
                  type="checkbox"
                />
                속도 점수 적용
              </label>
            </div>
            <div className="mt-4 grid gap-3">
              {question.answers.map((answer, answerIndex) => (
                <div className="grid gap-2 sm:grid-cols-[44px_1fr_88px]" key={answerIndex}>
                  <div className="grid h-11 place-items-center rounded-[8px] bg-black text-sm font-black text-white">
                    {ANSWER_LABELS[answerIndex]}
                  </div>
                  <input
                    className="focus-ring h-11 rounded-[8px] border border-black/15 px-3"
                    value={answer.text}
                    onChange={(event) =>
                      updateQuestion(questionIndex, {
                        answers: question.answers.map((item, index) =>
                          index === answerIndex ? { ...item, text: event.target.value } : item,
                        ),
                      })
                    }
                  />
                  <label className="flex h-11 items-center gap-2 rounded-[8px] border border-black/10 px-3 text-sm font-bold">
                    <input
                      checked={answer.isCorrect}
                      name={`correct-${questionIndex}`}
                      onChange={() => setCorrect(questionIndex, answerIndex)}
                      type="radio"
                    />
                    정답
                  </label>
                </div>
              ))}
            </div>
          </section>
        ))}

        {error ? <p className="font-bold text-red-600">{error}</p> : null}
        <div className="flex flex-wrap gap-3">
          <button
            className="focus-ring inline-flex items-center gap-2 rounded-[8px] border border-black/15 bg-white px-4 py-3 font-black"
            onClick={() => setQuiz((current) => ({ ...current, questions: [...current.questions, createEmptyQuestion()] }))}
            type="button"
          >
            <Plus size={18} aria-hidden />
            문제 추가
          </button>
          <button
            className="focus-ring inline-flex items-center gap-2 rounded-[8px] bg-[#141414] px-5 py-3 font-black text-white disabled:bg-black/30"
            disabled={saving}
            type="submit"
          >
            <Save size={18} aria-hidden />
            {saving ? "저장 중..." : "퀴즈 저장"}
          </button>
        </div>
      </form>

      {aiOpen ? <AiPanel onClose={() => setAiOpen(false)} onApply={setQuiz} /> : null}
    </div>
  );
}

function AiPanel({ onApply, onClose }: { onApply: (quiz: QuizInput) => void; onClose: () => void }) {
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState("normal");
  const [instructions, setInstructions] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function generate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await fetch("/api/ai/generate-quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, count, difficulty, instructions }),
    });
    setLoading(false);
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error || "AI 문제를 생성하지 못했습니다.");
      return;
    }
    const data = (await response.json()) as {
      title: string;
      description: string;
      questions: { question: string; answers: string[]; correctAnswerIndex: number }[];
    };
    onApply({
      title: data.title,
      description: data.description,
      questions: data.questions.map((question) => ({
        text: question.question,
        timeLimit: 20,
        pointsEnabled: true,
        answers: question.answers.map((answer, index) => ({
          text: answer,
          isCorrect: index === question.correctAnswerIndex,
        })),
      })),
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4">
      <form className="w-full max-w-xl rounded-[8px] bg-white p-6 shadow-2xl" onSubmit={generate}>
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black">AI 퀴즈 생성</h2>
          <button className="focus-ring rounded-[8px] px-3 py-2 font-bold" onClick={onClose} type="button">
            닫기
          </button>
        </div>
        <label className="mt-5 block text-sm font-black">주제</label>
        <input className="focus-ring mt-2 h-11 w-full rounded-[8px] border border-black/15 px-3" value={topic} onChange={(event) => setTopic(event.target.value)} />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-black">
            문제 수
            <input className="focus-ring mt-2 h-11 w-full rounded-[8px] border border-black/15 px-3" max={20} min={1} type="number" value={count} onChange={(event) => setCount(Number(event.target.value))} />
          </label>
          <label className="text-sm font-black">
            난이도
            <select className="focus-ring mt-2 h-11 w-full rounded-[8px] border border-black/15 px-3" value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>
              <option value="easy">쉬움</option>
              <option value="normal">보통</option>
              <option value="hard">어려움</option>
            </select>
          </label>
        </div>
        <label className="mt-4 block text-sm font-black">추가 지시사항</label>
        <textarea className="focus-ring mt-2 min-h-24 w-full rounded-[8px] border border-black/15 p-3" value={instructions} onChange={(event) => setInstructions(event.target.value)} />
        {error ? <p className="mt-3 font-bold text-red-600">{error}</p> : null}
        <button className="focus-ring mt-5 h-12 w-full rounded-[8px] bg-[#141414] font-black text-white disabled:bg-black/30" disabled={loading || !topic} type="submit">
          {loading ? "생성 중..." : "AI 퀴즈 생성"}
        </button>
      </form>
    </div>
  );
}

