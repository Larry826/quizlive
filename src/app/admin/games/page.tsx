import Link from "next/link";
import { createServiceClient, hasSupabaseConfig } from "@/lib/supabase/server";

type GameRow = {
  id: string;
  pin: string;
  status: string;
  created_at: string;
  quizzes: { title: string }[] | null;
  participants: { id: string; nickname: string; score: number }[];
};

export default async function GamesPage() {
  let games: GameRow[] = [];
  if (hasSupabaseConfig()) {
    const { data } = await createServiceClient()
      .from("games")
      .select("id,pin,status,created_at,quizzes(title),participants(id,nickname,score)")
      .order("created_at", { ascending: false })
      .limit(30);
    games = (data ?? []) as GameRow[];
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[8px] border border-black/10 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-black">게임 기록</h1>
        <p className="mt-2 font-semibold text-black/55">최근 라이브 게임과 TOP 3를 확인하세요.</p>
      </div>
      <div className="grid gap-3">
        {games.map((game) => {
          const top = [...game.participants].sort((a, b) => b.score - a.score).slice(0, 3);
          return (
            <article className="rounded-[8px] border border-black/10 bg-white p-5 shadow-sm" key={game.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black">{game.quizzes?.[0]?.title ?? "삭제된 퀴즈"}</h2>
                  <p className="mt-1 text-sm font-bold text-black/55">PIN {game.pin} · {game.status} · {game.participants.length}명</p>
                  <p className="mt-3 text-sm font-semibold text-black/60">
                    TOP 3: {top.length ? top.map((entry) => `${entry.nickname} ${entry.score}점`).join(", ") : "아직 참가 기록 없음"}
                  </p>
                </div>
                <Link className="focus-ring rounded-[8px] border border-black/15 px-3 py-2 text-sm font-black" href={`/admin/game/${game.id}`}>
                  열기
                </Link>
              </div>
            </article>
          );
        })}
        {games.length === 0 ? (
          <div className="rounded-[8px] border border-dashed border-black/20 bg-white p-8 text-center font-bold text-black/55">
            기록된 게임이 없습니다.
          </div>
        ) : null}
      </div>
    </div>
  );
}
