"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function JoinClient({ initialPin }: { initialPin: string }) {
  const router = useRouter();
  const [pin, setPin] = useState(initialPin.replace(/\D/g, "").slice(0, 6));
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function join(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await fetch("/api/games/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin, nickname }),
    });
    setLoading(false);
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error || "입장하지 못했습니다.");
      return;
    }
    const body = (await response.json()) as {
      participant: { id: string; nickname: string };
      gameId: string;
    };
    sessionStorage.setItem(`quizlive:${body.gameId}:participant`, JSON.stringify(body.participant));
    router.push(`/play/${body.gameId}`);
  }

  return (
    <main className="grid min-h-screen place-items-center px-5 py-8">
      <form className="w-full max-w-md rounded-[8px] border border-black/10 bg-white p-6 shadow-xl" onSubmit={join}>
        <Link className="text-sm font-black text-black/55" href="/">QuizLive</Link>
        <h1 className="mt-4 text-3xl font-black">닉네임 정하기</h1>
        <label className="mt-6 block text-sm font-black text-black/60" htmlFor="pin">PIN</label>
        <input
          id="pin"
          className="focus-ring mt-2 h-14 w-full rounded-[8px] border border-black/15 px-3 text-center font-mono text-2xl font-black tracking-[0.18em]"
          inputMode="numeric"
          value={pin}
          onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
        />
        <label className="mt-4 block text-sm font-black text-black/60" htmlFor="nickname">닉네임</label>
        <input
          id="nickname"
          className="focus-ring mt-2 h-14 w-full rounded-[8px] border border-black/15 px-3 text-lg font-bold"
          maxLength={20}
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
        />
        {error ? <p className="mt-3 font-bold text-red-600">{error}</p> : null}
        <button
          className="focus-ring mt-5 h-14 w-full rounded-[8px] bg-[#141414] font-black text-white disabled:bg-black/30"
          disabled={loading || pin.length !== 6 || nickname.trim().length === 0}
          type="submit"
        >
          {loading ? "입장 중..." : "대기실 입장"}
        </button>
      </form>
    </main>
  );
}
