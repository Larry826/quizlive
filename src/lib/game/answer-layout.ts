export const ANSWER_LAYOUT = [
  {
    index: 0,
    label: "A",
    position: "top-left",
    hostClass: "bg-[#ff6b6b] text-white border-[#e04949]",
    participantClass: "bg-[#ff6b6b] border-[#e04949]",
    ariaLabel: "첫 번째 선택지",
  },
  {
    index: 1,
    label: "B",
    position: "top-right",
    hostClass: "bg-[#5c7cfa] text-white border-[#3b5bdb]",
    participantClass: "bg-[#5c7cfa] border-[#3b5bdb]",
    ariaLabel: "두 번째 선택지",
  },
  {
    index: 2,
    label: "C",
    position: "bottom-left",
    hostClass: "bg-[#20c997] text-white border-[#0ca678]",
    participantClass: "bg-[#20c997] border-[#0ca678]",
    ariaLabel: "세 번째 선택지",
  },
  {
    index: 3,
    label: "D",
    position: "bottom-right",
    hostClass: "bg-[#f59f00] text-[#241403] border-[#e67700]",
    participantClass: "bg-[#f59f00] border-[#e67700]",
    ariaLabel: "네 번째 선택지",
  },
] as const;

export type AnswerLayoutItem = (typeof ANSWER_LAYOUT)[number];

