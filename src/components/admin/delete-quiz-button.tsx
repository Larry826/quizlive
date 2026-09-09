"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export function DeleteQuizButton({ quizId }: { quizId: string }) {
  const router = useRouter();
  return (
    <button
      className="focus-ring inline-flex items-center gap-2 rounded-[8px] border border-red-200 px-3 py-2 text-sm font-black text-red-700"
      onClick={async () => {
        if (!window.confirm("이 퀴즈를 삭제할까요?")) {
          return;
        }
        await fetch(`/api/admin/quizzes/${quizId}`, { method: "DELETE" });
        router.refresh();
      }}
      type="button"
    >
      <Trash2 size={16} aria-hidden />
      삭제
    </button>
  );
}

