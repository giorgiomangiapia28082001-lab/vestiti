import { Suspense } from "react";
import { AuthGate, Splash } from "@/components/layout/auth-gate";
import { BottomNav, SideNav } from "@/components/layout/nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  // L'app dipende dalla sessione dell'utente nel browser: la shell statica
  // mostra lo splash finché l'autenticazione non è verificata.
  return (
    <Suspense fallback={<Splash />}>
      <AuthGate>
        <div className="flex min-h-dvh">
          <SideNav />
          <main className="min-w-0 flex-1 px-4 pb-32 pt-[max(1rem,env(safe-area-inset-top))] sm:px-8 lg:px-12 lg:pb-16 lg:pt-10">
            <div className="mx-auto max-w-6xl">{children}</div>
          </main>
        </div>
        <BottomNav />
      </AuthGate>
    </Suspense>
  );
}
