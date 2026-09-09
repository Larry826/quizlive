import { NextRequest, NextResponse } from "next/server";
import { createAdminSessionValue, setAdminCookie } from "@/lib/auth/session";
import { jsonError } from "@/lib/http";

let failedAttempts = 0;
let blockedUntil = 0;

export async function POST(request: NextRequest) {
  const now = Date.now();
  if (blockedUntil > now) {
    return jsonError("잠시 후 다시 시도하세요.", 429);
  }

  const body = (await request.json().catch(() => ({}))) as { password?: string };
  const configuredPassword = process.env.ADMIN_PASSWORD;
  if (!configuredPassword) {
    return jsonError("관리자 비밀번호가 설정되지 않았습니다.", 503);
  }

  if (body.password !== configuredPassword) {
    failedAttempts += 1;
    if (failedAttempts >= 5) {
      blockedUntil = now + 60_000;
      failedAttempts = 0;
    }
    return jsonError("비밀번호가 올바르지 않습니다.", 401);
  }

  failedAttempts = 0;
  await setAdminCookie(createAdminSessionValue());
  return NextResponse.json({ ok: true });
}

