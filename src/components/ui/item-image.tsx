"use client";

import { Shirt } from "lucide-react";
import { useEffect, useState } from "react";
import { cachedImageUrl, getImageUrl } from "@/lib/data/images";
import { cn } from "@/lib/utils";

/** Fotografia di un capo da storage privato, con caricamento progressivo. */
export function ItemImage({
  path,
  alt,
  className,
  fit = "cover",
  sizes,
}: {
  path: string | null | undefined;
  alt: string;
  className?: string;
  fit?: "cover" | "contain";
  sizes?: string;
}) {
  const [fetched, setFetched] = useState<{ path: string; url: string | null } | null>(null);
  const [loadedPath, setLoadedPath] = useState<string | null>(null);
  const [failedPath, setFailedPath] = useState<string | null>(null);
  const url = cachedImageUrl(path) ?? (fetched && fetched.path === path ? fetched.url : null);
  const loaded = Boolean(path) && loadedPath === path;
  const failed = Boolean(path) && (failedPath === path || (fetched !== null && fetched.path === path && !fetched.url));

  useEffect(() => {
    if (!path || cachedImageUrl(path)) return;
    let active = true;
    getImageUrl(path).then((u) => {
      if (active) setFetched({ path, url: u });
    });
    return () => {
      active = false;
    };
  }, [path]);

  return (
    <div className={cn("relative overflow-hidden bg-surface-2", className)}>
      {!path || failed ? (
        <div className="absolute inset-0 grid place-items-center text-sand">
          <Shirt className="size-8" strokeWidth={1.3} aria-hidden />
          <span className="sr-only">{alt}</span>
        </div>
      ) : (
        <>
          {!loaded ? <div className="skeleton absolute inset-0" aria-hidden /> : null}
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element -- URL firmati e temporanei di Supabase Storage
            <img
              src={url}
              alt={alt}
              sizes={sizes}
              loading="lazy"
              decoding="async"
              onLoad={() => setLoadedPath(path ?? null)}
              onError={() => setFailedPath(path ?? null)}
              className={cn(
                "absolute inset-0 h-full w-full transition-opacity duration-500",
                fit === "cover" ? "object-cover" : "object-contain p-2",
                loaded ? "opacity-100" : "opacity-0",
              )}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
