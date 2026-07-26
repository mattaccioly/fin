import { type ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
};

const variants = {
  primary:
    "bg-[var(--accent)] text-[var(--accent-fg)] hover:brightness-110 active:brightness-95",
  secondary:
    "border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] hover:bg-[var(--surface-2)] hover:border-[var(--border-strong)]",
  ghost:
    "bg-transparent text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]",
  danger:
    "bg-[var(--negative-soft)] text-[var(--negative)] hover:brightness-105",
};

const sizes = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-base",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  disabled,
  ...props
}: Props) {
  return (
    <button
      className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-xl font-medium transition-[background-color,border-color,filter,opacity] duration-150 disabled:pointer-events-none disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled}
      {...props}
    />
  );
}
