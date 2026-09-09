import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminRequest } from "@/lib/auth/session";
import { LogoutButton } from "@/components/admin/logout-button";

const navItems = [
  { href: "/admin", label: "대시보드" },
  { href: "/admin/quizzes", label: "퀴즈 관리" },
  { href: "/admin/quizzes/new", label: "퀴즈 만들기" },
  { href: "/admin/games", label: "게임 기록" },
];

export async function AdminShell({ children }: Readonly<{ children: React.ReactNode }>) {
  if (!(await isAdminRequest())) {
    redirect("/");
  }

  return (
    <main className="min-h-screen bg-[#f7f3ec]/70">
      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 lg:grid-cols-[240px_1fr]">
        <aside className="rounded-[8px] border border-black/10 bg-[#141414] p-4 text-white shadow-xl lg:min-h-[calc(100vh-40px)]">
          <Link className="block text-2xl font-black" href="/admin">
            QuizLive
          </Link>
          <nav className="mt-8 grid gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                className="rounded-[8px] px-3 py-3 text-sm font-bold text-white/78 transition hover:bg-white/10 hover:text-white"
                href={item.href}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-8">
            <LogoutButton />
          </div>
        </aside>
        <section className="min-w-0">{children}</section>
      </div>
    </main>
  );
}

