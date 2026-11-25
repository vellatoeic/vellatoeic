// 검색(네이버·구글)·카카오톡 미리보기에 쓰는 이름과 설명 — 여기만 고치면 돼요.
import { BLOG_URL, CLASSROOM, INSTAGRAM_URL, SITE_URL } from "./config";

export const SITE_NAME = "벨라토익 vella_toeic";
// 네이버 서치어드바이저 기준: 제목 40자·설명 80자 이내 (페이지별 제목·설명도 같은 기준, '부산 서면 토익' 넣기)
export const SITE_TITLE = "부산 서면 토익 벨라토익(vella_toeic) | YBM 토익";
export const SITE_DESCRIPTION = "부산 서면 토익 벨라토익. 혼토익에 지친 모두 드루와! 토익에 필요한 것만 빠르게! YBM X vella_toeic 최단 프로젝트";

// 검색에 보여도 되는 공개 페이지 (sitemap.xml)
export const PUBLIC_PATHS = ["/", "/about", "/guide", "/guide/onsite", "/guide/online", "/faq", "/ybm"] as const;

// 검색에서 빼는 페이지: 로그인·개인 정보·관리 화면 (robots.txt)
export const PRIVATE_PATHS = ["/admin", "/api", "/class", "/check", "/my", "/mission", "/notices", "/special", "/ybm/", "/login"];

// 카카오톡·검색 미리보기 이미지 (app/opengraph-image.tsx가 만들어요)
export const OG_IMAGE = { url: "/opengraph-image", width: 1200, height: 630, alt: "부산 서면 토익 벨라토익 vella_toeic" };

// 페이지별 제목·설명·미리보기를 같은 모양으로 만들어요
export function pageMeta(title: string, description: string, path: string) {
  return {
    title,
    description,
    alternates: { canonical: path },
    // 페이지가 openGraph를 따로 정하면 기본 미리보기 이미지가 빠져서 같은 이미지를 다시 넣어요
    openGraph: { title, description, url: path, siteName: SITE_NAME, locale: "ko_KR", type: "website" as const, images: [OG_IMAGE] },
    twitter: { card: "summary_large_image" as const, title, description, images: [OG_IMAGE.url] },
  };
}

const ORG = {
  "@type": "EducationalOrganization",
  "@id": `${SITE_URL}/#org`,
  name: "벨라토익 (vella_toeic)",
  alternateName: ["벨라토익", "vella_toeic", "YBM 서면 벨라토익"],
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  address: { "@type": "PostalAddress", addressLocality: "부산광역시 부산진구", streetAddress: `서면 YBM ${CLASSROOM}`, addressCountry: "KR" },
  sameAs: [INSTAGRAM_URL, BLOG_URL],
};

const course = (name: string, description: string) => ({
  "@type": "Course",
  name,
  description,
  inLanguage: "ko",
  provider: { "@id": `${SITE_URL}/#org` },
  hasCourseInstance: [
    { "@type": "CourseInstance", courseMode: "onsite", location: `부산 서면 YBM ${CLASSROOM}` },
    { "@type": "CourseInstance", courseMode: "online", description: "유튜브 라이브(불라방)" },
  ],
});

// 구조화 데이터(JSON-LD): 학원 정보 + 과정
export function jsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      ORG,
      course("토익 시작반 (650 목표)", "토익 개념부터 차근차근. RC·LC 개념집으로 토익 650을 목표로 하는 4주 16회 과정."),
      course("토익 문풀반 (750 목표)", "개념을 아는 분을 위한 실전반. 점수가 오르는 풀이 감각을 끌어올려 토익 750을 목표로 하는 4주 16회 과정."),
      course("토익 속성반", "한 달에 시작반과 문풀반을 함께 듣는 주 4일 집중 과정."),
    ],
  };
}

// <script type="application/ld+json">에 넣을 문자열 ('<'는 안전하게 바꿔요)
export const jsonLdHtml = () => JSON.stringify(jsonLd()).replace(/</g, "\\u003c");
