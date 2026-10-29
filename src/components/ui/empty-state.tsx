import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  children,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex animate-fade-up flex-col items-center rounded-[28px] border border-dashed border-sand bg-surface/60 px-6 py-12 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="mb-5 grid size-16 place-items-center rounded-full bg-surface-2 text-ink-soft">{icon}</div>
      ) : null}
      <h3 className="font-display text-[26px] leading-tight">{title}</h3>
      {children ? <div className="mt-2 max-w-sm text-[14px] leading-relaxed text-muted">{children}</div> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
