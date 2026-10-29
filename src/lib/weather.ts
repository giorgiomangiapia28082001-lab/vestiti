"use client";

import { useCallback, useEffect, useState } from "react";

export type WeatherKind = "clear" | "cloudy" | "rain" | "snow" | "wind";

export interface Weather {
  temperature: number;
  apparent: number;
  min: number;
  max: number;
  kind: WeatherKind;
  label: string;
  fetchedAt: number;
}

const CONSENT_KEY = "weather-consent";
const CACHE_KEY = "weather-cache";
const TTL = 30 * 60 * 1000;

function describe(code: number, wind: number): { kind: WeatherKind; label: string } {
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { kind: "snow", label: "Neve" };
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(code)) {
    return { kind: "rain", label: code >= 95 ? "Temporale" : "Pioggia" };
  }
  if (wind >= 35) return { kind: "wind", label: "Ventoso" };
  if (code === 0) return { kind: "clear", label: "Sereno" };
  if (code <= 2) return { kind: "clear", label: "Poco nuvoloso" };
  if (code === 45 || code === 48) return { kind: "cloudy", label: "Nebbia" };
  return { kind: "cloudy", label: "Nuvoloso" };
}

function readStorage<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

async function fetchWeather(lat: number, lon: number): Promise<Weather> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", lat.toFixed(2));
  url.searchParams.set("longitude", lon.toFixed(2));
  url.searchParams.set("current", "temperature_2m,apparent_temperature,weather_code,wind_speed_10m");
  url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min");
  url.searchParams.set("forecast_days", "1");
  url.searchParams.set("timezone", "auto");
  const res = await fetch(url);
  if (!res.ok) throw new Error("Meteo non disponibile");
  const j = await res.json();
  const d = describe(j.current.weather_code, j.current.wind_speed_10m);
  return {
    temperature: Math.round(j.current.temperature_2m),
    apparent: Math.round(j.current.apparent_temperature),
    min: Math.round(j.daily.temperature_2m_min[0]),
    max: Math.round(j.daily.temperature_2m_max[0]),
    ...d,
    fetchedAt: Date.now(),
  };
}

function locate(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("Geolocalizzazione non supportata"));
    navigator.geolocation.getCurrentPosition(resolve, reject, { maximumAge: 3_600_000, timeout: 10_000 });
  });
}

/**
 * Meteo locale da Open-Meteo (gratuito, senza chiave). La posizione viene
 * richiesta solo dopo il consenso esplicito dell'utente.
 */
export function useWeather() {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "denied" | "error">("idle");

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const pos = await locate();
      writeStorage(CONSENT_KEY, true);
      const w = await fetchWeather(pos.coords.latitude, pos.coords.longitude);
      writeStorage(CACHE_KEY, w);
      setWeather(w);
      setStatus("ready");
    } catch (e) {
      const denied = e instanceof GeolocationPositionError && e.code === e.PERMISSION_DENIED;
      if (denied) writeStorage(CONSENT_KEY, false);
      setStatus(denied ? "denied" : "error");
    }
  }, []);

  useEffect(() => {
    const cached = readStorage<Weather>(CACHE_KEY);
    if (cached && Date.now() - cached.fetchedAt < TTL) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- lettura della cache locale dopo l'idratazione
      setWeather(cached);
      setStatus("ready");
      return;
    }
    if (readStorage<boolean>(CONSENT_KEY) === true) load();
  }, [load]);

  return { weather, status, enable: load };
}
