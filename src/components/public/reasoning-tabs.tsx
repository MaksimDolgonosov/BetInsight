"use client";

import { useState } from "react";

export function ReasoningTabs({
  locale,
  ru,
  en,
  empty,
}: {
  locale: string;
  ru: string | null;
  en: string | null;
  empty: string;
}) {
  const [lang, setLang] = useState<"ru" | "en">(locale === "ru" ? "ru" : "en");
  const text = (lang === "ru" ? ru : en) || (lang === "ru" ? en : ru) || empty;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex w-fit rounded-full border border-[var(--bi-border)] bg-[var(--bi-bg)] p-1">
        <LangButton active={lang === "ru"} onClick={() => setLang("ru")}>RU</LangButton>
        <LangButton active={lang === "en"} onClick={() => setLang("en")}>EN</LangButton>
      </div>
      <p className="text-[14px] leading-6 text-[var(--bi-text-2)]">{text}</p>
    </div>
  );
}

function LangButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 font-stat text-[11px] font-semibold ${active ? "bg-[var(--bi-tab)] text-[var(--bi-text)]" : "text-[var(--bi-text-3)]"}`}
    >
      {children}
    </button>
  );
}
