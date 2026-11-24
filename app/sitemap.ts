import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/config";
import { PUBLIC_PATHS } from "@/lib/seo";

// 검색에 알려 줄 공개 페이지 목록
export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PATHS.map((path) => ({
    url: `${SITE_URL}${path === "/" ? "" : path}`,
    changeFrequency: path === "/" || path === "/about" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : path === "/about" ? 0.9 : 0.7,
  }));
}
