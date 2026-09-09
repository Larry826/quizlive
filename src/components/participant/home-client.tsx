"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, LogIn, Sparkles } from "lucide-react";

export function HomeClient() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [adminOpen, setAdminOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function normalizePin(value: string) {
    return value.replace(/\D/g, "").slice(0, 6);
  }

  async function loginAdmin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error || "로그인할 수 없습니다.");
      return;
    }
    router.push("/admin");
  }

  return (
    <main className="min-h-screen px-5 py-5 sm:px-8">
      <header className="mx-auto flex max-w-5xl items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-[8px] bg-[#141414] text-white shadow-sm">
            <Sparkles size={22} aria-hidden />
          </div>
          <span className="text-xl font-black tracking-normal">QuizLive</span>
        </div>
        <button
          className="focus-ring inline-flex items-center gap-2 rounded-[8px] border border-black/10 bg-white/80 px-3 py-2 text-sm font-bold shadow-sm transition hover:bg-white"
          onClick={() => setAdminOpen(true)}
          type="button"
        >
          <LockKeyhole size={16} aria-hidden />
          관리자
        </button>
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-84px)] max-w-5xl items-center gap-10 py-8 lg:grid-cols-[1fr_0.9fr]">
        <div className="space-y-7">
          <div className="inline-flex rounded-[8px] bg-[#20c997] px-3 py-1 text-sm font-black text-[#05291f]">
            실시간 퀴즈 입장
          </div>
          <div className="space-y-4">
            <h1 className="max-w-2xl text-5xl font-black leading-tight tracking-normal text-[#141414] sm:text-6xl">
              게임에 참가하기
            </h1>
            <p className="max-w-xl text-lg leading-8 text-black/65">
              출제자가 알려준 6자리 PIN을 입력하고 닉네임을 정하면 바로 대기실로 이동합니다.
            </p>
          </div>
        </div>

        <form
          className="rounded-[8px] border border-black/10 bg-white p-5 shadow-[0_24px_80px_rgba(20,20,20,0.12)] sm:p-7"
          onSubmit={(event) => {
            event.preventDefault();
            if (pin.length === 6) {
              router.push(`/join?pin=${pin}`);
            }
          }}
        >
          <label className="block text-sm font-black text-black/70" htmlFor="pin">
            6자리 PIN
          </label>
          <input
            id="pin"
            inputMode="numeric"
            autoComplete="one-time-code"
            className="focus-ring mt-3 h-20 w-full rounded-[8px] border border-black/15 bg-[#f8fafc] px-4 text-center font-mono text-4xl font-black tracking-[0.25em]"
            value={pin}
            onChange={(event) => setPin(normalizePin(event.target.value))}
            placeholder="000000"
          />
          <button
            className="focus-ring mt-5 inline-flex h-14 w-full items-center justify-center gap-2 rounded-[8px] bg-[#141414] px-5 text-base font-black text-white transition hover:bg-[#2f2f2f] disabled:cursor-not-allowed disabled:bg-black/30"
            disabled={pin.length !== 6}
            type="submit"
          >
            <LogIn size={20} aria-hidden />
            참가하기
          </button>
          <p className="mt-4 text-center text-sm font-semibold text-black/55">
            QR로 들어온 경우 PIN은 자동으로 채워집니다.
          </p>
        </form>
      </section>

      {adminOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-5">
          <form
            className="w-full max-w-sm rounded-[8px] bg-white p-6 shadow-2xl"
            onSubmit={loginAdmin}
          >
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-2xl font-black">관리자 로그인</h2>
              <button
                className="focus-ring rounded-[8px] px-3 py-2 text-sm font-bold hover:bg-black/5"
                onClick={() => setAdminOpen(false)}
                type="button"
              >
                닫기
              </button>
            </div>
            <label className="mt-6 block text-sm font-black text-black/70" htmlFor="password">
              비밀번호
            </label>
            <input
              id="password"
              className="focus-ring mt-2 h-12 w-full rounded-[8px] border border-black/15 px-3"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoFocus
            />
            {error ? <p className="mt-3 text-sm font-bold text-red-600">{error}</p> : null}
            <button
              className="focus-ring mt-5 h-12 w-full rounded-[8px] bg-[#141414] font-black text-white disabled:bg-black/30"
              disabled={loading || !password}
              type="submit"
            >
              {loading ? "확인 중..." : "관리자로 로그인"}
            </button>
          </form>
        </div>
      ) : null}
    </main>
  );
}

