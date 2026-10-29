"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  back,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: React.ReactNode;
  back?: string | boolean;
  actions?: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();
  return (
    <header className={cn("animate-fade-up pb-6 pt-2", className)}>
      {back ? (
        <button
          type="button"
          onClick={() => (typeof back === "string" ? router.push(back) : router.back())}
          className="-ml-2 mb-3 inline-flex h-10 items-center gap-1.5 rounded-full px-2 text-[13px] font-semibold text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="size-4" /> Indietro
        </button>
      ) : null}
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
          <h1 className="font-display text-[40px] leading-[1.02] sm:text-[52px]">{title}</h1>
          {subtitle ? <div className="mt-2 text-[14.5px] leading-relaxed text-muted">{subtitle}</div> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
