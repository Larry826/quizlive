import Link from "next/link";
import { Bot, ClipboardList, Radio, Users } from "lucide-react";
import { createServiceClient, hasSupabaseConfig } from "@/lib/supabase/server";

export default async function AdminPage() {
  const stats = { quizzes: 0, games: 0, participants: 0 };
  if (hasSupabaseConfig()) {
    const supabase = createServiceClient();
    const [{ count: quizzes }, { count: games }, { count: participants }] = await Promise.all([
      supabase.from("quizzes").select("id", { count: "exact", head: true }),
      supabase.from("games").select("id", { count: "exact", head: true }),
      supabase.from("participants").select("id", { count: "exact", head: true }),
    ]);
    stats.quizzes = quizzes ?? 0;
    stats.games = games ?? 0;
    stats.participants = participants ?? 0;
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[8px] border border-black/10 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-black">관리자 대시보드</h1>
        <p className="mt-2 font-semibold text-black/55">
          퀴즈를 만들고 PIN/QR로 라이브 게임을 진행하세요.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "전체 퀴즈", value: stats.quizzes, icon: ClipboardList },
          { label: "최근 게임", value: stats.games, icon: Radio },
          { label: "최근 참가자", value: stats.participants, icon: Users },
        ].map((item) => (
          <div className="rounded-[8px] border border-black/10 bg-white p-5 shadow-sm" key={item.label}>
            <item.icon size={22} aria-hidden />
            <div className="mt-4 text-4xl font-black">{item.value}</div>
            <div className="mt-1 text-sm font-bold text-black/55">{item.label}</div>
          </div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Link className="focus-ring rounded-[8px] bg-[#141414] px-4 py-4 font-black text-white" href="/admin/quizzes/new">
          새 퀴즈 만들기
        </Link>
        <Link className="focus-ring rounded-[8px] bg-[#20c997] px-4 py-4 font-black text-[#06281f]" href="/admin/quizzes/new">
          <Bot className="mr-2 inline" size={18} aria-hidden />
          AI로 퀴즈 만들기
        </Link>
        <Link className="focus-ring rounded-[8px] border border-black/10 bg-white px-4 py-4 font-black" href="/admin/quizzes">
          기존 퀴즈로 게임 시작
        </Link>
      </div>
    </div>
  );
}

