import type { NextConfig } from "next";

// 수강증 글자 읽기(tesseract.js)는 워커 파일을 경로로 찾아서 묶지 않아요(serverExternalPackages).
// 파일 추적이 워커 쪽 require를 못 따라가서, 수강증을 읽는 신청서 페이지(/guide/[kind]) 서버 함수에 직접 실어요.
// 이게 빠지면 배포 뒤 "Cannot find module"로 글자 읽기가 멈춰요(신청은 '선생님 확인'으로 계속 받아요).
const TESSERACT_FILES = [
  "./node_modules/tesseract.js/src/**",
  "./node_modules/tesseract.js-core/**",
  "./node_modules/bmp-js/**",
  "./node_modules/is-url/**",
  "./node_modules/idb-keyval/**",
  "./node_modules/regenerator-runtime/**",
  "./node_modules/zlibjs/**",
  "./node_modules/wasm-feature-detect/**",
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["tesseract.js"],
  outputFileTracingIncludes: { "/guide/*": TESSERACT_FILES },
  // 숙제 사진·수강증 업로드 (휴대폰에서 줄여서 보내지만 여유 있게)
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
};
export default nextConfig;
