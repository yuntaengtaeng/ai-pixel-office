import type { TaskStatus } from "@ai-pixel-office/domain/entities";

type OfficeStatus = TaskStatus | "idle";

export const OFFICE_STATUS_LABEL: Record<OfficeStatus, string> = {
  idle: "쉬는 중",
  todo: "준비 중",
  working: "작업 중",
  needs_review: "검토 부탁해요",
  needs_input: "질문 있어요",
  blocked: "막혔어요",
  done: "작업 마쳤어요",
  failed: "문제가 생겼어요",
};
const DEFAULT_IDLE_MESSAGES = [
  "커피 한 모금 마시는 중",
  "기지개를 쭉 켜는 중",
  "창밖을 잠깐 보는 중",
  "새 작업을 기다리는 중",
  "동료에게 인사하는 중",
];

const SPECIAL_PET_MESSAGES: Record<string, Record<OfficeStatus | "recently_done", string[]>> = {
  "rabbit-yuzu": {
    idle: ["귀가 심심해서 들썩이는 중", "재밌는 일 없나?"],
    todo: ["금방 끝내고 올게!"],
    working: ["손이 아주 바빠!", "생각보다 신나는데?"],
    needs_review: ["짜잔! 얼른 봐 줘!"],
    needs_input: ["잠깐, 이것만 알려 줘!"],
    blocked: ["귀가 축 처졌어..."],
    done: ["다음 일도 가져와!"],
    failed: ["한 번 더 뛰어 볼래"],
    recently_done: ["끝! 나 꽤 빠르지?"],
  },
  "capybara-gamja": {
    idle: ["햇볕 좋은 자리를 찾는 중", "천천히 기다리고 있어"],
    todo: ["서두르지 않아도 괜찮아"],
    working: ["차근차근 하고 있어", "생각을 푹 익히는 중"],
    needs_review: ["편하게 한번 봐 줘"],
    needs_input: ["이것만 알면 이어갈 수 있어"],
    blocked: ["잠깐 쉬면서 길을 찾을게"],
    done: ["다음 일도 느긋하게"],
    failed: ["괜찮아, 다시 해 보면 돼"],
    recently_done: ["잘 익었어. 확인해 봐"],
  },
  "quokka-bangul": {
    idle: ["누가 먼저 웃나 기다리는 중", "같이 할 일을 찾는 중"],
    todo: ["같이하면 금방이야!"],
    working: ["좋아, 호흡이 딱 맞아!", "신나게 맞춰 보는 중"],
    needs_review: ["우리 결과 좀 봐 줄래?"],
    needs_input: ["같이 정하면 더 좋을 것 같아"],
    blocked: ["동료와 다른 길을 찾아볼게"],
    done: ["다음에도 같이하자!"],
    failed: ["다시 모이면 할 수 있어"],
    recently_done: ["우리 함께 해냈어!"],
  },
};

export function petMessage({
  petId,
  status,
  recentlyDone,
  cycleSecond,
}: {
  petId?: string;
  status: OfficeStatus;
  recentlyDone: boolean;
  cycleSecond: number;
}): string | undefined {
  const idleVisible = cycleSecond % 18 < 5;
  const workingVisible = cycleSecond % 13 < 3;
  const special = petId ? SPECIAL_PET_MESSAGES[petId] : undefined;
  if (special) {
    if (!recentlyDone && status === "idle" && !idleVisible) return undefined;
    if (!recentlyDone && status === "working" && !workingVisible) return undefined;
    const messages = special[recentlyDone ? "recently_done" : status];
    return messages[Math.abs(cycleSecond) % messages.length];
  }
  if (recentlyDone) return "방금 작업을 마쳤어요!";
  if (status === "idle")
    return idleVisible
      ? DEFAULT_IDLE_MESSAGES[Math.floor(cycleSecond / 18) % DEFAULT_IDLE_MESSAGES.length]
      : undefined;
  if (status === "working" && !workingVisible) return undefined;
  if (status === "todo") return "시작을 기다리고 있어요.";
  return OFFICE_STATUS_LABEL[status];
}
