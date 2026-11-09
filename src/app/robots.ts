import type { MetadataRoute } from "next";
import { siteOrigin } from "@/server/site";

export default function robots(): MetadataRoute.Robots {
  const origin = siteOrigin();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/ru/admin", "/en/admin", "/api/"],
    },
    sitemap: `${origin}/sitemap.xml`,
  };
}
