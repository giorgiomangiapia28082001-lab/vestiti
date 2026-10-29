import { cn } from "@/lib/utils";

export function Brand({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-baseline gap-1.5", className)}>
      <span className="font-display text-[26px] italic leading-none">Wardrobe</span>
      <span className="rounded-full bg-olive px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-white dark:text-bg">
        AI
      </span>
    </span>
  );
}
