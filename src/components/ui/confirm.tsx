"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Button } from "./button";
import { Sheet } from "./sheet";

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  destructive?: boolean;
}

const ConfirmContext = createContext<(o: ConfirmOptions) => Promise<boolean>>(async () => false);

/** Conferma prima delle operazioni distruttive: `await confirm({...})`. */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<(v: boolean) => void>(null);

  const confirm = useCallback((o: ConfirmOptions) => {
    setOptions(o);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOptions(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Sheet
        open={Boolean(options)}
        onOpenChange={(open) => !open && close(false)}
        title={options?.title ?? ""}
        description={options?.message}
      >
        <div className="flex flex-col-reverse gap-2 pt-4 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => close(false)}>
            Annulla
          </Button>
          <Button
            className={options?.destructive ? "bg-danger text-white hover:bg-danger hover:brightness-110" : undefined}
            onClick={() => close(true)}
            autoFocus
          >
            {options?.confirmLabel ?? "Conferma"}
          </Button>
        </div>
      </Sheet>
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);
