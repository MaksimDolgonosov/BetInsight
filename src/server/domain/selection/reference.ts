import { z } from "zod";

const keySchema = z.string().trim().regex(/^[a-z0-9_]{3,80}$/);
const nameSchema = z.string().trim().min(1).max(80);

export type TeamMetaInput = {
  teamName: string;
  sportKey: string;
  leagueKey: string;
  tableRank: number | null;
  isRelegation: boolean;
};

export type RivalryInput = {
  sportKey: string;
  teamA: string;
  teamB: string;
  label: string | null;
};

export function parseTeamMetaInput(input: {
  teamName: string;
  sportKey: string;
  leagueKey: string;
  tableRank: string;
  relegation: boolean;
}): { ok: true; row: TeamMetaInput } | { ok: false; error: "invalid" } {
  const rank = input.tableRank.trim();
  const parsed = z
    .object({
      teamName: nameSchema,
      sportKey: keySchema,
      leagueKey: keySchema,
      tableRank: z.number().int().min(1).max(40).nullable(),
    })
    .safeParse({
      teamName: input.teamName,
      sportKey: input.sportKey.trim() || input.leagueKey.trim(),
      leagueKey: input.leagueKey,
      tableRank: rank === "" ? null : Number(rank),
    });
  if (!parsed.success) return { ok: false, error: "invalid" };
  return { ok: true, row: { ...parsed.data, isRelegation: input.relegation } };
}

export function parseRivalryInput(input: {
  sportKey: string;
  teamA: string;
  teamB: string;
  label: string;
}): { ok: true; row: RivalryInput } | { ok: false; error: "invalid" } {
  const parsed = z
    .object({
      sportKey: keySchema,
      teamA: nameSchema,
      teamB: nameSchema,
      label: z.string().trim().max(80),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  if (parsed.data.teamA.trim().toLowerCase() === parsed.data.teamB.trim().toLowerCase()) {
    return { ok: false, error: "invalid" };
  }
  const [teamA, teamB] = parsed.data.teamA.localeCompare(parsed.data.teamB) <= 0
    ? [parsed.data.teamA, parsed.data.teamB]
    : [parsed.data.teamB, parsed.data.teamA];
  return {
    ok: true,
    row: {
      sportKey: parsed.data.sportKey,
      teamA,
      teamB,
      label: parsed.data.label || null,
    },
  };
}
