import { z } from "zod";

export const timeLimitSchema = z.union([
  z.literal(5),
  z.literal(10),
  z.literal(15),
  z.literal(20),
  z.literal(30),
  z.literal(45),
  z.literal(60),
]);

export const quizInputSchema = z.object({
  title: z.string().trim().min(1, "퀴즈 제목을 입력하세요.").max(120),
  description: z.string().trim().max(500).default(""),
  questions: z
    .array(
      z.object({
        text: z.string().trim().min(1, "문제 내용을 입력하세요.").max(500),
        timeLimit: timeLimitSchema.default(15),
        pointsEnabled: z.boolean().default(true),
        answers: z
          .array(
            z.object({
              text: z.string().trim().min(1, "선택지를 입력하세요.").max(240),
              isCorrect: z.boolean(),
            }),
          )
          .length(4, "선택지는 4개여야 합니다.")
          .refine((answers) => answers.filter((answer) => answer.isCorrect).length === 1, {
            message: "문제마다 정답은 하나여야 합니다.",
          }),
      }),
    )
    .min(1, "문제를 하나 이상 입력하세요.")
    .max(50),
});

export const aiQuizRequestSchema = z.object({
  topic: z.string().trim().min(1).max(120),
  count: z.coerce.number().int().min(1).max(20),
  difficulty: z.enum(["easy", "normal", "hard"]),
  instructions: z.string().trim().max(600).optional().default(""),
});

export const aiQuizResponseSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).default(""),
  questions: z
    .array(
      z.object({
        question: z.string().trim().min(1).max(500),
        answers: z.array(z.string().trim().min(1).max(240)).length(4),
        correctAnswerIndex: z.number().int().min(0).max(3),
        explanation: z.string().trim().max(500).optional().default(""),
      }),
    )
    .min(1)
    .max(20),
});

export const joinGameSchema = z.object({
  pin: z.string().trim().regex(/^\d{6}$/, "6자리 PIN을 입력하세요."),
  nickname: z
    .string()
    .trim()
    .min(1, "닉네임을 입력하세요.")
    .max(20, "닉네임은 20자 이하로 입력하세요."),
});

export const answerSubmitSchema = z.object({
  participantId: z.string().uuid(),
  answerId: z.string().uuid(),
});
