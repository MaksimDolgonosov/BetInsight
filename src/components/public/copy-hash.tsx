"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CopyHash({ value, label, copied }: { value: string; label: string; copied: string }) {
  const [done, setDone] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setDone(true);
          window.setTimeout(() => setDone(false), 1600);
        });
      }}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--bi-border)] px-2.5 py-1 text-[12px] text-[var(--bi-text-2)]"
    >
      {done ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {done ? copied : label}
    </button>
  );
}
