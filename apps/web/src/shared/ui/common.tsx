import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <span className="kicker">{eyebrow}</span>
        <h1>{title}</h1>
      </div>
      {action}
    </header>
  );
}

export function FullScreenMessage({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <div className={`full-message ${error ? "error" : ""}`}>
      <span>{error ? "!" : "…"}</span>
      <strong>{children}</strong>
    </div>
  );
}

export function ErrorBanner({ children }: { children: ReactNode }) {
  return <div className="error-banner">! {children}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}
