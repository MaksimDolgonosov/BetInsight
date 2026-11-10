import { getTranslations } from "next-intl/server";
import { shareContentType, shareImage, shareSize } from "@/server/share-image";

export const alt = "BetInsight";
export const size = shareSize;
export const contentType = shareContentType;

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "public.stats" });
  return shareImage(t("title"), t("description"));
}
