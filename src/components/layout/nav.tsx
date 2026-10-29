"use client";

import { CalendarDays, Heart, Home, Plus, Settings, Shirt, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Brand } from "./brand";

const MAIN = [
  { href: "/", label: "Home", icon: Home },
  { href: "/wardrobe", label: "Guardaroba", icon: Shirt },
  { href: "/generate", label: "Stylist", icon: Sparkles },
  { href: "/outfits", label: "Outfit", icon: Heart },
] as const;

const EXTRA = [
  { href: "/calendar", label: "Calendario", icon: CalendarDays },
  { href: "/settings", label: "Profilo e preferenze", icon: Settings },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function BottomNav() {
  const pathname = usePathname();
  if (pathname === "/wardrobe/new") return null;
  const [a, b, c, d] = MAIN;
  return (
    <nav
      aria-label="Navigazione principale"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line/80 bg-bg/85 backdrop-blur-xl pb-safe lg:hidden"
    >
      <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center px-2">
        {[a, b].map((item) => (
          <NavTab key={item.href} {...item} active={isActive(pathname, item.href)} />
        ))}
        <div className="flex justify-center">
          <Link
            href="/wardrobe/new"
            aria-label="Aggiungi un capo"
            className="grid size-13 -translate-y-3 place-items-center rounded-full bg-ink text-bg shadow-lift transition-transform active:scale-95"
          >
            <Plus className="size-6" strokeWidth={2} />
          </Link>
        </div>
        {[c, d].map((item) => (
          <NavTab key={item.href} {...item} active={isActive(pathname, item.href)} />
        ))}
      </div>
    </nav>
  );
}

function NavTab({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex flex-col items-center gap-1 py-1.5 text-[10.5px] font-semibold transition-colors",
        active ? "text-ink" : "text-muted",
      )}
    >
      <Icon className="size-[22px]" strokeWidth={active ? 2 : 1.6} />
      {label}
    </Link>
  );
}

export function SideNav() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line px-5 py-8 lg:flex">
      <Link href="/" className="px-3">
        <Brand />
      </Link>
      <Link
        href="/wardrobe/new"
        className="mt-8 flex h-11 items-center justify-center gap-2 rounded-full bg-ink text-sm font-semibold text-bg shadow-soft transition-transform active:scale-[0.98]"
      >
        <Plus className="size-4" /> Aggiungi un capo
      </Link>
      <nav aria-label="Navigazione principale" className="mt-8 space-y-1">
        {[...MAIN, ...EXTRA].map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-11 items-center gap-3 rounded-full px-4 text-[14px] font-medium transition-colors",
                active ? "bg-surface text-ink shadow-soft" : "text-muted hover:bg-surface/60 hover:text-ink",
              )}
            >
              <Icon className="size-[18px]" strokeWidth={active ? 2 : 1.7} />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
