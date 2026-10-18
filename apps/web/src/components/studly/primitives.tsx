import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { Icon } from "./Icon";

export function Button({ variant = "primary", className = "", type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" }) {
  return <button type={type} className={`${variant === "primary" ? "primary-btn" : variant === "secondary" ? "secondary-btn" : "reset-btn"} ${className}`} {...props} />;
}

export function Field({ label, hint, error, id, ...props }: InputHTMLAttributes<HTMLInputElement> & { id: string; label: string; hint?: string; error?: string }) {
  const description = error ?? hint;
  return <div className="filter-group"><label htmlFor={id}>{label}</label><input id={id} aria-invalid={!!error} aria-describedby={description ? `${id}-hint` : undefined} {...props} />{description && <span className={error ? "filter-error" : "field-hint"} id={`${id}-hint`}>{description}</span>}</div>;
}

export function StatusPanel({ kind, title, children, action }: { kind: "loading" | "error" | "empty" | "unsupported"; title: string; children?: ReactNode; action?: ReactNode }) {
  return <div className={`empty-state status-panel status-${kind}`} role={kind === "error" ? "alert" : "status"} aria-busy={kind === "loading"}>
    <Icon name={kind === "loading" ? "grid" : "search"} />
    <h3>{title}</h3>{children && <div className="status-copy">{children}</div>}{action}
    {kind === "loading" && <div className="loading-lines" aria-hidden="true"><span /><span /><span /></div>}
  </div>;
}
