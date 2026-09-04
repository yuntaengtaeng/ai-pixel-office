import type { IconProps } from "./type.ts";

export function TrashIcon({ size = 24, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M8 5V3h8v2h4v2h-1l-1 14H6L5 7H4V5h4Zm2 0h4V4h-4v1ZM7 7l.86 12h8.28L17 7H7Zm3 2h2v8h-2V9Zm4 0h2v8h-2V9Z"
      />
    </svg>
  );
}
