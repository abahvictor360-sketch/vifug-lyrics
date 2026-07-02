import { cn } from "../lib/utils";
import { chipClass } from "../lib/sections";

export function SectionChip({ label, type, className }: { label: string; type: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        chipClass(type),
        className,
      )}
    >
      {label}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent",
        className,
      )}
    />
  );
}

export function VButton({
  variant = "subtle",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "danger" | "ghost" | "subtle" | "ok";
  size?: "sm" | "md" | "lg";
}) {
  const variants: Record<string, string> = {
    primary: "bg-[var(--v-accent)] text-black hover:brightness-110 font-semibold",
    danger: "bg-[var(--v-live)] text-white hover:brightness-110 font-semibold",
    ok: "bg-[var(--v-ok)] text-black hover:brightness-110 font-semibold",
    ghost: "bg-transparent text-[var(--v-text-dim)] hover:bg-[var(--v-surface-3)] hover:text-[var(--v-text)]",
    subtle: "bg-[var(--v-surface-2)] text-[var(--v-text)] hover:bg-[var(--v-surface-3)] border border-[var(--v-border)]",
  };
  const sizes: Record<string, string> = {
    sm: "h-8 px-2.5 text-xs rounded-md gap-1.5",
    md: "h-9 px-3.5 text-sm rounded-md gap-2",
    lg: "h-11 px-5 text-base rounded-lg gap-2",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center transition-colors disabled:opacity-40 disabled:pointer-events-none select-none",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
