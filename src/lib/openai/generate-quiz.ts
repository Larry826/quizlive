import OpenAI from "openai";
import { aiQuizResponseSchema } from "@/lib/validation/quiz";
import type { Difficulty } from "@/types/quiz";

const difficultyLabels: Record<Difficulty, string> = {
  easy: "쉬움",
  normal: "보통",
  hard: "어려움",
};

export async function generateQuizWithOpenAI(params: {
  topic: string;
  count: number;
  difficulty: Difficulty;
  instructions?: string;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;

  if (!apiKey || !model) {
    throw new Error("OpenAI API가 설정되지 않았습니다.");
  }

  const client = new OpenAI({ apiKey });
  const response = await client.responses.create({
    model,
    input: [
      {
        role: "system",
        content:
          "너는 실시간 퀴즈용 객관식 문제 출제자다. 반드시 JSON만 출력한다. 모든 문제는 4지선다이며 정답은 하나다. 중복 선택지와 모호한 문제를 만들지 않는다.",
      },
      {
        role: "user",
        content: JSON.stringify({
          language: "ko",
          topic: params.topic,
          questionCount: params.count,
          difficulty: difficultyLabels[params.difficulty],
          extraInstructions: params.instructions || "",
          outputShape: {
            title: "string",
            description: "string",
            questions: [
              {
                question: "string",
                answers: ["string", "string", "string", "string"],
                correctAnswerIndex: 0,
                explanation: "string",
              },
            ],
          },
        }),
      },
    ],
  });

  const parsed = JSON.parse(response.output_text);
  return aiQuizResponseSchema.parse(parsed);
}

