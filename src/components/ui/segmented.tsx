"use client";

import { cn } from "@/lib/utils";

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: readonly { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div role="tablist" className={cn("no-scrollbar flex gap-1 overflow-x-auto rounded-full bg-surface-2 p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-9 shrink-0 grow rounded-full px-4 text-[13px] font-semibold transition-all duration-200",
            value === o.value ? "bg-surface text-ink shadow-soft" : "text-muted hover:text-ink",
          )}
        >
          {o.label}
          {o.count !== undefined ? <span className="ml-1.5 text-muted">{o.count}</span> : null}
        </button>
      ))}
    </div>
  );
}
