"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const tooltipStyle = {
  background: "oklch(0.205 0 0)",
  border: "1px solid oklch(1 0 0 / 12%)",
  borderRadius: 12,
  color: "oklch(0.985 0 0)",
};

export function BankChart({ series, profitLabel }: { series: { label: string; profit: number }[]; profitLabel: string }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="oklch(1 0 0 / 12%)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: "oklch(0.708 0 0)", fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis width={36} tick={{ fill: "oklch(0.708 0 0)", fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Line type="monotone" dataKey="profit" name={profitLabel} stroke="oklch(0.922 0 0)" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CalibrationChart({
  series,
  predictedLabel,
  actualLabel,
}: {
  series: { label: string; predicted: number; actual: number }[];
  predictedLabel: string;
  actualLabel: string;
}) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="oklch(1 0 0 / 12%)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: "oklch(0.708 0 0)", fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis width={36} tick={{ fill: "oklch(0.708 0 0)", fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="predicted" name={predictedLabel} fill="oklch(0.708 0 0)" radius={4} />
          <Bar dataKey="actual" name={actualLabel} fill="oklch(0.922 0 0)" radius={4} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
