import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { jsonError, parseError } from "@/lib/http";
import { generateQuizWithOpenAI } from "@/lib/openai/generate-quiz";
import { aiQuizRequestSchema } from "@/lib/validation/quiz";

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const input = aiQuizRequestSchema.parse(await request.json());
    const quiz = await generateQuizWithOpenAI(input);
    return NextResponse.json(quiz);
  } catch (error) {
    const status = error instanceof Error && error.message === "ADMIN_UNAUTHORIZED" ? 401 : 400;
    return jsonError(parseError(error), status);
  }
}

