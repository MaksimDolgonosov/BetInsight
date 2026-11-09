"use client";

import { Timer } from "lucide-react";
import { useEffect, useState } from "react";

export function Countdown({ at, started }: { at: string; started: string }) {
  const [label, setLabel] = useState(() => remaining(at, started));

  useEffect(() => {
    const update = () => setLabel(remaining(at, started));
    update();
    const timer = window.setInterval(update, 30_000);
    return () => window.clearInterval(timer);
  }, [at, started]);

  const urgent = new Date(at).getTime() - Date.now() < 12 * 60 * 60 * 1000;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[14px] font-semibold ${urgent ? "text-[var(--bi-accent)]" : "text-[var(--bi-text-2)]"}`}>
      <Timer className="size-3.5" />
      {label}
    </span>
  );
}

function remaining(at: string, started: string) {
  const minutes = Math.round((new Date(at).getTime() - Date.now()) / 60000);
  if (minutes <= 0) return started;
  if (minutes < 60) return `${minutes}м`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}ч ${minutes % 60}м`;
  const days = Math.floor(hours / 24);
  return `${days}д ${hours % 24}ч`;
}
