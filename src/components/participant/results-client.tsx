"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

export function ResultsClient() {
  return (
    <main className="grid min-h-screen place-items-center px-5 py-8">
      <section className="w-full max-w-md rounded-[8px] border border-black/10 bg-white p-8 text-center shadow-xl">
        <CheckCircle2 className="mx-auto text-[#20c997]" size={52} aria-hidden />
        <h1 className="mt-5 text-4xl font-black">퀴즈가 종료되었습니다</h1>
        <p className="mt-3 font-semibold leading-7 text-black/60">
          참여해 주셔서 감사합니다. 최종 결과는 출제자 화면에서 확인할 수 있습니다.
        </p>
        <Link className="focus-ring mt-6 block rounded-[8px] bg-[#141414] px-4 py-4 text-center font-black text-white" href="/">
          처음으로
        </Link>
      </section>
    </main>
  );
}
