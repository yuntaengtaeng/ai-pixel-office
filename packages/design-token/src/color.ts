const BRAND_SECONDARY = "#9db8ff";
const ON_BRAND_MUTED = "#8b93a1";

export const colors = {
  brand: {
    primary: "#7aa2ff",
    /** 가장 어두운 크롬 면(사이드바, 코드 블록) */
    primaryDark: "#0b0d10",
    secondary: BRAND_SECONDARY,
    secondaryTint: `${BRAND_SECONDARY}1A`,
  },
  background: {
    canvas: "#0f1115",
    surface: "#161920",
    surfaceRaised: "#1c2029",
    surfaceMuted: "#13161c",
    positiveSubtle: "#17301f",
    negativeSubtle: "#3a1f1f",
    surfaceTranslucent: "#161920E6",
    actionTranslucent: "#FFFFFF14",
  },
  text: {
    primary: "#e8eaf0",
    secondary: "#aab1bd",
    muted: "#8b93a1",
    inverse: "#0f1115",
    onBrand: "#0f1115",
    onBrandMuted: ON_BRAND_MUTED,
    positive: "#6ee7a0",
    negative: "#ff8a8a",
  },
  semantic: {
    positive: "#4ade80",
    negative: "#f87171",
    warning: "#f7c46c",
    info: "#7aa2ff",
  },
  /** 파랑 = 진행, 주황 = 사람의 판단 필요(도장 색), 노랑 = 질문, 빨강 = 실패, 초록 = 완료 */
  status: {
    todo: "#8b93a1",
    queued: "#a78bfa",
    working: "#60a5fa",
    needsReview: "#f26b4f",
    needsInput: "#f7c46c",
    blocked: "#f87171",
    failed: "#ef4444",
    done: "#4ade80",
  },
  priority: {
    high: "#f87171",
    medium: "#f7c46c",
    low: "#6ee7a0",
  },
  runtime: {
    claude: "#e0896a",
    codex: "#3fbf96",
  },
  runStatus: {
    queued: "#8b93a1",
    running: "#60a5fa",
    completed: "#4ade80",
    failed: "#f87171",
  },
  projectStatus: {
    active: { border: "#2f6f4f", background: "#17301f", foreground: "#6ee7a0" },
    paused: { border: "#6b5a2a", background: "#33291a", foreground: "#f7c46c" },
    done: { border: "#3a3f4a", background: "#1c2029", foreground: "#aab1bd" },
  },
  feedback: {
    info: { border: "#2f4a7a", background: "#16203a" },
    warning: { border: "#6b5a2a", background: "#2a2316" },
    danger: { border: "#7a2f2a", background: "#2e1816" },
  },
  border: {
    default: "#2a2f39",
    subtle: "#22262f",
    strong: "#4a5262",
    focus: "#7aa2ff",
    positive: "#2f6f4f",
    negative: "#7a2f2a",
  },
  shadow: {
    default: "#00000066",
    focus: "#7aa2ff66",
    positive: "#4ade8033",
    negative: "#f8717133",
    glow: "#7aa2ff33",
    dialog: "#000000B3",
    snackbar: "#00000080",
  },
  overlay: {
    scrim: "#05060AB3",
  },
  action: {
    primary: {
      foreground: "#0f1115",
      background: "#e8eaf0",
      border: "#e8eaf0",
      shadow: "#00000000",
    },
    secondary: {
      foreground: "#e8eaf0",
      background: "#1c2029",
      border: "#343a46",
      shadow: "#00000000",
    },
    danger: {
      foreground: "#ffffff",
      background: "#b3372f",
      border: "#b3372f",
      shadow: "#00000000",
    },
  },
  /** 결재 행동과 결재란 도장 색 */
  stamp: {
    ink: "#f26b4f",
    soft: "#3a1f1a",
    onStamp: "#0f1115",
  },
} as const;

export type Colors = typeof colors;

export const color = colors;
