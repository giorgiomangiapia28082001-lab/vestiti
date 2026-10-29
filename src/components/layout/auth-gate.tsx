"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/auth-provider";
import { Brand } from "./brand";
import { SetupNotice } from "./setup-notice";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading, configured } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (configured && !loading && !user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [configured, loading, user, router, pathname]);

  if (!configured) return <SetupNotice />;
  if (loading || !user) return <Splash />;
  return <>{children}</>;
}

export function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center" aria-busy="true">
      <Brand className="animate-pulse" />
    </div>
  );
}
