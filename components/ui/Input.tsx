import { type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";

const fieldClass =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-[var(--fg)] outline-none transition placeholder:text-[var(--fg-muted)] hover:border-[var(--border-strong)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)] disabled:opacity-50";

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${fieldClass} h-10 ${className}`} {...props} />;
}

export function Textarea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${fieldClass} resize-none py-2.5 ${className}`} {...props} />;
}

export function Select({
  className = "",
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  // Drop default sizing when the caller sets an explicit width/height utility.
  const hasWidth = /\b(w-|min-w-|max-w-)/.test(className);
  const hasHeight = /\b(h-|min-h-|max-h-)/.test(className);
  const base = hasWidth ? fieldClass.replace(/\bw-full\b/, "").trim() : fieldClass;
  const height = hasHeight ? "" : "h-10";
  return (
    <select className={`${base} ${height} ${className}`.replace(/\s+/g, " ").trim()} {...props}>
      {children}
    </select>
  );
}

export function Label({
  children,
  htmlFor,
  className = "",
}: {
  children: React.ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={`mb-1.5 block text-sm font-medium text-[var(--fg-muted)] ${className}`}
    >
      {children}
    </label>
  );
}
