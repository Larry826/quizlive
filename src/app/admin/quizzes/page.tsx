import Link from "next/link";
import { Edit } from "lucide-react";
import { DeleteQuizButton } from "@/components/admin/delete-quiz-button";
import { StartGameButton } from "@/components/admin/start-game-button";
import { createServiceClient, hasSupabaseConfig } from "@/lib/supabase/server";

type QuizRow = {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  questions: { id: string }[];
};

export default async function QuizzesPage() {
  let quizzes: QuizRow[] = [];
  if (hasSupabaseConfig()) {
    const { data } = await createServiceClient()
      .from("quizzes")
      .select("id,title,description,created_at,questions(id)")
      .order("created_at", { ascending: false });
    quizzes = (data ?? []) as QuizRow[];
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-black/10 bg-white p-6 shadow-sm">
        <div>
          <h1 className="text-3xl font-black">퀴즈 관리</h1>
          <p className="mt-2 font-semibold text-black/55">저장된 퀴즈를 수정하거나 라이브 게임을 시작하세요.</p>
        </div>
        <Link className="focus-ring rounded-[8px] bg-[#141414] px-4 py-3 font-black text-white" href="/admin/quizzes/new">
          새 퀴즈
        </Link>
      </div>

      {quizzes.length === 0 ? (
        <div className="rounded-[8px] border border-dashed border-black/20 bg-white p-8 text-center font-bold text-black/55">
          저장된 퀴즈가 없습니다.
        </div>
      ) : (
        <div className="grid gap-3">
          {quizzes.map((quiz) => (
            <article className="rounded-[8px] border border-black/10 bg-white p-5 shadow-sm" key={quiz.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black">{quiz.title}</h2>
                  <p className="mt-1 text-sm font-semibold text-black/55">{quiz.description}</p>
                  <p className="mt-3 text-sm font-black text-black/60">{quiz.questions.length}문제</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StartGameButton quizId={quiz.id} />
                  <Link className="focus-ring inline-flex items-center gap-2 rounded-[8px] border border-black/15 px-3 py-2 text-sm font-black" href={`/admin/quizzes/${quiz.id}/edit`}>
                    <Edit size={16} aria-hidden />
                    수정
                  </Link>
                  <DeleteQuizButton quizId={quiz.id} />
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

