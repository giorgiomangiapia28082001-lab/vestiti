import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const dateFmt = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long" });
const dateFmtYear = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric" });

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value.length === 10 ? `${value}T12:00:00` : value) : value;
  return d.getFullYear() === new Date().getFullYear() ? dateFmt.format(d) : dateFmtYear.format(d);
}

/** Data locale in formato YYYY-MM-DD. */
export function isoDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function daysSince(value: string | null | undefined) {
  if (!value) return null;
  const d = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}

export function relativeDays(value: string | null | undefined) {
  const n = daysSince(value);
  if (n === null) return "Mai indossato";
  if (n <= 0) return "Oggi";
  if (n === 1) return "Ieri";
  if (n < 30) return `${n} giorni fa`;
  if (n < 365) return `${Math.floor(n / 30)} mesi fa`;
  return "Oltre un anno fa";
}

export function errorMessage(error: unknown, fallback = "Qualcosa è andato storto. Riprova.") {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return fallback;
}
