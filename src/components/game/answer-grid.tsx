import { ANSWER_LAYOUT } from "@/lib/game/answer-layout";

type GridAnswer = {
  id: string;
  answer_index: number;
  answer_text?: string;
};

export function AnswerGrid({
  answers,
  className = "",
  disabled,
  mode,
  onAnswer,
  selectedId,
}: {
  answers: GridAnswer[];
  className?: string;
  disabled?: boolean;
  mode: "host" | "participant";
  onAnswer?: (answerId: string) => void;
  selectedId?: string;
}) {
  const ordered = ANSWER_LAYOUT.map((layout) => ({
    layout,
    answer: answers.find((answer) => answer.answer_index === layout.index),
  }));

  if (mode === "participant") {
    return (
      <div className={`grid flex-1 grid-cols-2 grid-rows-2 gap-2 ${className}`}>
        {ordered.map(({ answer, layout }) => (
          <button
            aria-label={layout.ariaLabel}
            className={`focus-ring min-h-[150px] rounded-[8px] border-4 shadow-lg transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-80 sm:min-h-[220px] ${
              layout.participantClass
            } ${selectedId === answer?.id ? "scale-[0.98] ring-4 ring-black/40" : ""}`}
            disabled={disabled || !answer}
            key={layout.index}
            onClick={() => answer && onAnswer?.(answer.id)}
            type="button"
          />
        ))}
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-2 grid-rows-2 gap-3 ${className}`}>
      {ordered.map(({ answer, layout }) => (
        <div
          className={`flex min-h-0 flex-col items-center justify-center gap-[clamp(0.4rem,1.2vh,1rem)] overflow-hidden rounded-[8px] border-4 px-[clamp(0.75rem,1.6vw,1.5rem)] py-[clamp(0.6rem,1.4vh,1.25rem)] text-center shadow-lg ${layout.hostClass}`}
          key={layout.index}
        >
          <div className="text-[clamp(2rem,4vw,4.5rem)] font-black leading-none">{layout.label}</div>
          <div className="max-h-full max-w-[90%] whitespace-normal break-keep text-[clamp(2rem,3.5vw,4rem)] font-black leading-[1.12] [overflow-wrap:anywhere]">
            {answer?.answer_text ?? ""}
          </div>
        </div>
      ))}
    </div>
  );
}
