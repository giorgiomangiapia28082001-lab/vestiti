"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function StarRating({
  value,
  onChange,
  size = "md",
}: {
  value: number | null;
  onChange?: (v: number | null) => void;
  size?: "sm" | "md";
}) {
  const icon = size === "sm" ? "size-4" : "size-6";
  return (
    <div className="flex items-center gap-0.5" role={onChange ? "radiogroup" : undefined} aria-label="Valutazione">
      {[1, 2, 3, 4, 5].map((n) => {
        const active = (value ?? 0) >= n;
        const star = <Star className={cn(icon, active ? "fill-brown text-brown" : "text-sand")} strokeWidth={1.6} />;
        if (!onChange) return <span key={n}>{star}</span>;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} su 5`}
            onClick={() => onChange(value === n ? null : n)}
            className="rounded-full p-1 transition-transform active:scale-90"
          >
            {star}
          </button>
        );
      })}
    </div>
  );
}
