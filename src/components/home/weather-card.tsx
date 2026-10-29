"use client";

import { Cloud, CloudRain, CloudSnow, MapPin, Sun, Wind } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Weather } from "@/lib/weather";

const ICONS = { clear: Sun, cloudy: Cloud, rain: CloudRain, snow: CloudSnow, wind: Wind };

export function WeatherCard({
  weather,
  status,
  onEnable,
}: {
  weather: Weather | null;
  status: "idle" | "loading" | "ready" | "denied" | "error";
  onEnable: () => void;
}) {
  if (weather) {
    const Icon = ICONS[weather.kind];
    return (
      <div className="flex items-center gap-4 rounded-[24px] border border-line bg-surface p-4 shadow-soft">
        <div className="grid size-12 place-items-center rounded-full bg-olive-soft text-olive">
          <Icon className="size-6" strokeWidth={1.6} />
        </div>
        <div className="min-w-0">
          <p className="font-display text-[30px] leading-none">{weather.temperature}°</p>
          <p className="mt-1 text-[12.5px] text-muted">
            {weather.label} · percepiti {weather.apparent}° · min {weather.min}° max {weather.max}°
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between gap-3 rounded-[24px] border border-dashed border-sand p-4">
      <div className="flex items-center gap-3 text-[13px] text-muted">
        <MapPin className="size-4 shrink-0" />
        {status === "denied"
          ? "Posizione non autorizzata: il meteo è disattivato."
          : status === "error"
            ? "Meteo non disponibile al momento."
            : "Attiva il meteo locale per outfit adatti alla giornata."}
      </div>
      {status !== "denied" ? (
        <Button size="sm" variant="secondary" onClick={onEnable} loading={status === "loading"}>
          Attiva
        </Button>
      ) : null}
    </div>
  );
}
