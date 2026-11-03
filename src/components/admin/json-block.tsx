"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function JsonBlock({
  value,
  summary,
  copyLabel,
  copiedLabel,
}: {
  value: unknown;
  summary: string;
  copyLabel: string;
  copiedLabel: string;
}) {
  const text = JSON.stringify(value, null, 2) ?? "";
  const [copied, setCopied] = useState(false);

  return (
    <details className="rounded-lg border bg-background">
      <summary className="cursor-pointer px-3 py-2 text-sm">{summary}</summary>
      <div className="border-t px-3 py-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            setCopied(true);
          }}
        >
          {copied ? copiedLabel : copyLabel}
        </Button>
        <pre className="mt-3 overflow-x-auto text-xs leading-5">
          <code>{highlight(text)}</code>
        </pre>
      </div>
    </details>
  );
}

function highlight(json: string) {
  const pattern = /("(?:\\.|[^"\\])*")(\s*:)?|\b-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b|true|false|null/g;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let index = 0;

  for (const match of json.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > cursor) nodes.push(json.slice(cursor, start));
    const token = match[0];
    const isKey = Boolean(match[2]);
    const className = isKey
      ? "text-sky-300"
      : token.startsWith("\"")
        ? "text-emerald-300"
        : token === "null" || token === "true" || token === "false"
          ? "text-amber-200"
          : "text-orange-200";
    nodes.push(
      <span key={index} className={className}>
        {token}
      </span>,
    );
    index += 1;
    cursor = start + token.length;
  }

  if (cursor < json.length) nodes.push(json.slice(cursor));
  return nodes;
}
