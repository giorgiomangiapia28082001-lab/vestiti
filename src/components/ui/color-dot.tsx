import { colorInfo } from "@/lib/domain";
import { cn } from "@/lib/utils";

export function ColorDot({ color, className }: { color: string; className?: string }) {
  const info = colorInfo(color);
  const style =
    info.hex === "conic"
      ? { background: "conic-gradient(#c0322f, #ecd04a, #2f7a4a, #2f5fb3, #5e3f87, #c0322f)" }
      : { background: info.hex };
  return (
    <span
      aria-hidden
      className={cn("inline-block size-3.5 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/15", className)}
      style={style}
    />
  );
}
