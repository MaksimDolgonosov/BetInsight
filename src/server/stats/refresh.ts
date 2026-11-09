import { revalidateTag } from "next/cache";

export function refreshPublicBoard() {
  try {
    revalidateTag("public-stats", "max");
  } catch {
    return;
  }
}
