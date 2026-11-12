export function sportMark(sportKey: string) {
  if (sportKey.startsWith("soccer")) return "⚽";
  if (sportKey.startsWith("basketball")) return "🏀";
  if (sportKey.startsWith("icehockey")) return "🏒";
  if (sportKey.startsWith("tennis")) return "🎾";
  return "•";
}

export function teamMark(name: string) {
  const letters = name.normalize("NFKD").replace(/[^\p{L}\p{N}]/gu, "");
  return (letters.slice(0, 3) || name.slice(0, 3) || "•").toUpperCase();
}
