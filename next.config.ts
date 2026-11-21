import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp"],
  outputFileTracingIncludes: {
    "/api/webhook": ["./fonts/**/*"],
    "/api/sticker": ["./fonts/**/*"],
  },
};

export default nextConfig;
