const BRAND_SECONDARY = "#4d7f8a";
const ON_BRAND_MUTED = "#a9c3b5";

export const colors = {
  brand: {
    primary: "#4e8874",
    primaryDark: "#386758",
    secondary: BRAND_SECONDARY,
    secondaryTint: `${BRAND_SECONDARY}1A`,
  },
  background: {
    canvas: "#eee7dc",
    surface: "#fffaf0",
    surfaceRaised: "#fffdfa",
    surfaceMuted: "#eee3d2",
    positiveSubtle: "#e8f1ec",
    negativeSubtle: "#f7dfdc",
    surfaceTranslucent: "#FFFFFFA3",
    actionTranslucent: "#FFFFFF8C",
  },
  text: {
    primary: "#453d38",
    secondary: "#665c54",
    muted: "#847a72",
    inverse: "#fffaf0",
    onBrand: "#fff9ec",
    onBrandMuted: ON_BRAND_MUTED,
    positive: "#3f6b5c",
    negative: "#9f413d",
  },
  semantic: {
    positive: "#599875",
    negative: "#c85f58",
    warning: "#f2c66f",
    info: "#4d7f8a",
  },
  status: {
    todo: "#c19a54",
    working: "#4c8a75",
    needsReview: "#8b68b5",
    needsInput: "#487fad",
    blocked: "#c85f58",
    failed: "#a54349",
    done: "#599875",
  },
  priority: {
    high: "#d5685e",
    medium: "#d4ac67",
    low: "#6fa389",
  },
  runtime: {
    claude: "#c9714f",
    codex: "#2a8f6f",
  },
  runStatus: {
    queued: "#9a9189",
    running: "#54a076",
    completed: "#4f8c75",
    failed: "#c65b56",
  },
  projectStatus: {
    active: { border: "#739786", background: "#e2efe8", foreground: "#3b6b59" },
    paused: { border: "#b89259", background: "#f5e8cf", foreground: "#815e31" },
    done: { border: "#8b8990", background: "#e9e7eb", foreground: "#626068" },
  },
  feedback: {
    info: { border: "#548273", background: "#e9f5ed" },
    warning: { border: "#b07c34", background: "#fff2cf" },
    danger: { border: "#ae554d", background: "#ffebe3" },
  },
  border: {
    default: "#bcae9c",
    subtle: "#d4c7b6",
    strong: "#6d5347",
    focus: "#4e8874",
    positive: "#6f9e8b",
    negative: "#c7938e",
  },
  shadow: {
    default: "#cbbdac",
    focus: ON_BRAND_MUTED,
    positive: "#b9cfc4",
    negative: "#d4aaa4",
    glow: "#63b48655",
    dialog: "#141F1C7A",
    snackbar: "#493B3138",
  },
  overlay: {
    scrim: "#1F26249E",
  },
  action: {
    primary: {
      foreground: "#fff9ec",
      background: "#4e8874",
      border: "#2f5448",
      shadow: "#294d42",
    },
    secondary: {
      foreground: "#59483d",
      background: "#f1dfbc",
      border: "#8d704f",
      shadow: "#b59876",
    },
    danger: {
      foreground: "#ffffff",
      background: "#c45d58",
      border: "#763c39",
      shadow: "#783d39",
    },
  },
} as const;

export type Colors = typeof colors;

export const color = colors;
