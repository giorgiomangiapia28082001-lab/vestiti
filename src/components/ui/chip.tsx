import { cn } from "@/lib/utils";

export function Chip({
  selected,
  onClick,
  children,
  className,
  size = "md",
  ...props
}: {
  selected?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md";
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick">) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border font-medium transition-all duration-200 active:scale-95",
        size === "sm" ? "h-8 px-3 text-[12.5px]" : "h-10 px-4 text-[13.5px]",
        selected
          ? "border-ink bg-ink text-bg"
          : "border-line bg-surface text-ink-soft hover:border-sand hover:text-ink",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/** Gruppo di chip a selezione multipla o singola. */
export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  multiple = true,
  size,
  render,
  label,
}: {
  options: readonly { value: T; label: string }[];
  value: T[];
  onChange: (v: T[]) => void;
  multiple?: boolean;
  size?: "sm" | "md";
  render?: (o: { value: T; label: string }) => React.ReactNode;
  label?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
      {options.map((o) => {
        const selected = value.includes(o.value);
        return (
          <Chip
            key={o.value}
            size={size}
            selected={selected}
            onClick={() => {
              if (multiple) onChange(selected ? value.filter((v) => v !== o.value) : [...value, o.value]);
              else onChange(selected ? [] : [o.value]);
            }}
          >
            {render ? render(o) : o.label}
          </Chip>
        );
      })}
    </div>
  );
}
