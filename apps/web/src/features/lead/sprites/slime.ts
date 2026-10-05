import type { LeadPose } from "../utils/leadView.ts";

/** 팀장 슬라임 팔레트 (픽셀 콘텐츠 색) */
export const SLIME_PALETTE: Record<string, string> = {
  b: "#6fd1b0",
  h: "#d4f7ea",
  s: "#2f7f66",
  e: "#0f1115",
  m: "#1f5a48",
  c: "#8b93a1",
  p: "#e8eaf0",
  o: "#f26b4f",
};

const BODY = [
  "..bbbbbbbbbbbb..",
  "..bbbebbbbebbb..",
  ".bbbbebbbbebbbb.",
  ".bbbbbbmmbbbbbb.",
  ".bbbbbbbbbbbbbb.",
  ".sbbbbbbbbbbbbs.",
  "..ssssssssssss..",
  "................",
];

/** 상태별 16x16 픽셀 모양 (한 글자 = 한 칸, "."은 비움) */
export const SLIME_POSES: Record<LeadPose, string[]> = {
  idle: [
    "................",
    "................",
    "................",
    "................",
    "................",
    "......bbbb......",
    "....bbhhbbbb....",
    "...bbhhbbbbbb...",
    ...BODY,
  ],
  plan: [
    "................",
    "................",
    ".......bbbb.....",
    "......bhhbbb....",
    "......bhbbbb....",
    "......bebbeb....",
    "......bbbbbb.cc.",
    ".....bbbmmbbbcpc",
    ".....bbbbbbbbcpc",
    "....bbbbbbbbbcc.",
    "....bbbbbbbbb...",
    "...bbbbbbbbbbb..",
    "...bbbbbbbbbbb..",
    "..sbbbbbbbbbbbs.",
    "...sssssssssss..",
    "................",
  ],
  wait: [
    "................",
    "...........oo...",
    "..........oooo..",
    "...........oo...",
    "...........b....",
    "......bbbb.b....",
    "....bbhhbbbb....",
    "...bbhhbbbbbb...",
    ...BODY,
  ],
};

export const SLIME_POSE_LABEL: Record<LeadPose, string> = {
  idle: "팀장 · 대화 대기",
  plan: "팀장 · 계획 중",
  wait: "팀장 · 결재 기다림",
};
