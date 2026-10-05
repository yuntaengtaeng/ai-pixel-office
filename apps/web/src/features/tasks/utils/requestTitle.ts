const TITLE_LENGTH = 60;

/** 요청문 첫 줄로 기안서 제목을 만듦 (길면 줄임) */
export function requestTitle(message: string): string {
  const firstLine = message.trim().split(/\r?\n/)[0]?.trim() ?? "";
  return firstLine.length > TITLE_LENGTH ? `${firstLine.slice(0, TITLE_LENGTH - 1)}…` : firstLine;
}
