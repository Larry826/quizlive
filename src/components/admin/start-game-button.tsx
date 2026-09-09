"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";

export function StartGameButton({ quizId }: { quizId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <button
      className="focus-ring inline-flex items-center gap-2 rounded-[8px] bg-[#5c7cfa] px-3 py-2 text-sm font-black text-white disabled:bg-black/30"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        const response = await fetch("/api/games", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quizId }),
        });
        setLoading(false);
        if (response.ok) {
          const game = (await response.json()) as { id: string };
          router.push(`/admin/game/${game.id}`);
        }
      }}
      type="button"
    >
      <Play size={16} aria-hidden />
      라이브 시작
    </button>
  );
}

