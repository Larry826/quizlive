import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "QuizLive",
  description: "실시간 다중 사용자 퀴즈 진행 플랫폼",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="ko"
      className="h-full antialiased"
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
