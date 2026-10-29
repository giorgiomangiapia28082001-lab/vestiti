"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Pannello modale accessibile: sale dal basso su smartphone, appare
 * centrato su schermi grandi.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 animate-fade-in bg-black/35 backdrop-blur-[2px]" />
        <Dialog.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] animate-sheet-up flex-col rounded-t-[28px] bg-surface shadow-lift outline-none",
            "sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[min(560px,92vw)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:animate-fade-up sm:rounded-[28px]",
            className,
          )}
        >
          <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-line sm:hidden" aria-hidden />
          <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-4">
            <div>
              <Dialog.Title className="font-display text-[26px] leading-tight">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-[13.5px] text-muted">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            <Dialog.Close
              className="-mr-2 grid size-10 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-ink"
              aria-label="Chiudi"
            >
              <X className="size-5" />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">{children}</div>
          {footer ? <div className="border-t border-line px-6 py-4 pb-safe">{footer}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
