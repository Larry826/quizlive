import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function parseError(error: unknown) {
  if (error instanceof ZodError) {
    return error.issues[0]?.message || "입력값을 확인하세요.";
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "요청을 처리하지 못했습니다.";
}

