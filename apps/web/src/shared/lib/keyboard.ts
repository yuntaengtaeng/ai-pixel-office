export type SubmitKeyEvent = {
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  nativeEvent: { isComposing?: boolean; keyCode?: number };
};

export function isSubmitKey(
  event: SubmitKeyEvent,
  mode: "enter" | "modifier-enter" = "enter",
): boolean {
  if (
    event.key !== "Enter" ||
    event.nativeEvent.isComposing === true ||
    event.nativeEvent.keyCode === 229
  )
    return false;
  if (mode === "modifier-enter") return event.ctrlKey || event.metaKey;
  return !event.shiftKey;
}
