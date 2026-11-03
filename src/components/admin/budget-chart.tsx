"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function BudgetChart({
  series,
  creditsLabel,
}: {
  series: { day: string; credits: number }[];
  creditsLabel: string;
}) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="oklch(1 0 0 / 12%)" vertical={false} />
          <XAxis dataKey="day" tick={{ fill: "oklch(0.708 0 0)", fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} width={32} tick={{ fill: "oklch(0.708 0 0)", fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{
              background: "oklch(0.205 0 0)",
              border: "1px solid oklch(1 0 0 / 12%)",
              borderRadius: 12,
              color: "oklch(0.985 0 0)",
            }}
          />
          <Area type="monotone" dataKey="credits" name={creditsLabel} stroke="oklch(0.922 0 0)" fill="oklch(0.922 0 0 / 18%)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
