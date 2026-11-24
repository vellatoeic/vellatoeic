import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/config";
import { PRIVATE_PATHS } from "@/lib/seo";

// 검색 로봇 안내: 공개 페이지는 허용, 로그인·개인 정보·관리 화면은 제외
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
