export function isUpcomingKickoff(pick: { status: string; commenceTime?: string | null }) {
  return pick.status === "pending" && !!pick.commenceTime && new Date(pick.commenceTime).getTime() > Date.now();
}

export function hasKickedOff(commenceTime?: string | null) {
  return !!commenceTime && new Date(commenceTime).getTime() <= Date.now();
}
