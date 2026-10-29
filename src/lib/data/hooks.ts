"use client";

import useSWR, { mutate as globalMutate } from "swr";
import { useAuth } from "@/components/auth-provider";
import type { ClothingItem, Outfit, Profile } from "../schemas";
import * as api from "./api";

// Le chiavi includono l'utente, così i dati non si mescolano tra account.
const key = (name: string, userId: string | undefined, ...rest: string[]) => (userId ? [name, userId, ...rest] : null);

export function useItems() {
  const { user } = useAuth();
  return useSWR<ClothingItem[]>(key("items", user?.id), () => api.listItems());
}

export function useOutfits() {
  const { user } = useAuth();
  return useSWR<Outfit[]>(key("outfits", user?.id), () => api.listOutfits());
}

export function useProfile() {
  const { user } = useAuth();
  return useSWR<Profile | null>(key("profile", user?.id), () => api.getProfile());
}

export function useHistory() {
  const { user } = useAuth();
  return useSWR<api.HistoryEntry[]>(key("history", user?.id), () => api.listHistory());
}

export function usePlanned(from: string, to: string) {
  const { user } = useAuth();
  return useSWR<api.PlannedEntry[]>(key("planned", user?.id, from, to), () => api.listPlanned(from, to));
}

export function useAiStatus() {
  return useSWR("ai-status", () => api.fetchAiStatus(), { revalidateIfStale: false });
}

/** Ricarica tutte le cache che iniziano con uno dei nomi indicati. */
export function refresh(...names: string[]) {
  return globalMutate((k) => Array.isArray(k) && names.includes(k[0] as string));
}
