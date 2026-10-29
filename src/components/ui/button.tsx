import { Loader2 } from "lucide-react";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const variants = {
  primary: "bg-ink text-bg hover:bg-ink-soft shadow-soft",
  secondary: "bg-surface text-ink border border-line hover:border-sand hover:bg-surface-2",
  ghost: "text-ink hover:bg-surface-2",
  olive: "bg-olive text-white hover:brightness-110 shadow-soft dark:text-bg",
  danger: "bg-surface text-danger border border-line hover:bg-danger hover:text-white hover:border-danger",
} as const;

const sizes = {
  sm: "h-9 px-3.5 text-[13px] gap-1.5",
  md: "h-11 px-5 text-sm gap-2",
  lg: "h-13 px-6 text-[15px] gap-2.5",
  icon: "h-10 w-10 justify-center",
} as const;

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", loading, disabled, children, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold tracking-tight transition-all duration-200 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
});
