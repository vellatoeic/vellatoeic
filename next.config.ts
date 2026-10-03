import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  // 숙제 사진 업로드 (휴대폰에서 줄여서 보내지만 여유 있게)
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
};
export default nextConfig;
