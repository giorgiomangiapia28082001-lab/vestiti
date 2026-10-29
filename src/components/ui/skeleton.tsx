import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton rounded-2xl", className)} />;
}

export function GridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-busy="true" aria-label="Caricamento">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="aspect-[4/5] w-full" />
          <Skeleton className="h-3.5 w-3/4 rounded-full" />
          <Skeleton className="h-3 w-1/2 rounded-full" />
        </div>
      ))}
    </div>
  );
}
