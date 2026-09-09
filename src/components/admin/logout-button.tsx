"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      className="focus-ring w-full rounded-[8px] border border-white/15 px-3 py-3 text-left text-sm font-bold text-white/78 transition hover:bg-white/10 hover:text-white"
      onClick={async () => {
        await fetch("/api/admin/logout", { method: "POST" });
        router.push("/");
        router.refresh();
      }}
      type="button"
    >
      로그아웃
    </button>
  );
}

