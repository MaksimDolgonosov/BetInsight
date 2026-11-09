"use client";

import { useEffect, useState } from "react";

export function KickoffClock({ at, started, dayUnit, hourUnit }: { at: string; started: string; dayUnit: string; hourUnit: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const secondsLeft = Math.floor((new Date(at).getTime() - now) / 1000);
  if (secondsLeft <= 0) {
    return <span className="font-display text-[40px] font-semibold tracking-[-1px] lg:text-[56px]">{started}</span>;
  }

  const hours = Math.floor(secondsLeft / 3600);
  if (hours >= 48) {
    return (
      <span className="font-stat text-[40px] font-semibold tracking-[-1px] text-[var(--bi-accent)] lg:text-[56px]">
        {Math.floor(hours / 24)}{dayUnit} {hours % 24}{hourUnit}
      </span>
    );
  }

  const minutes = Math.floor((secondsLeft % 3600) / 60);
  const seconds = secondsLeft % 60;
  const label = [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
  return <span className="font-stat text-[40px] font-semibold tracking-[-1px] text-[var(--bi-accent)] lg:text-[56px]">{label}</span>;
}
