"use client";

import { Toaster } from "sonner";
import { SWRConfig } from "swr";
import { AuthProvider } from "./auth-provider";
import { ThemeProvider } from "./theme-provider";
import { ConfirmProvider } from "./ui/confirm";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SWRConfig value={{ revalidateOnFocus: false, keepPreviousData: true, errorRetryCount: 2 }}>
          <ConfirmProvider>{children}</ConfirmProvider>
        </SWRConfig>
        <Toaster
          position="top-center"
          toastOptions={{
            classNames: {
              toast: "!bg-surface !text-ink !border-line !rounded-2xl !shadow-lift !font-sans",
              description: "!text-muted",
            },
          }}
        />
      </AuthProvider>
    </ThemeProvider>
  );
}
