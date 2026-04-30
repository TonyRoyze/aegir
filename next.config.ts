import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@react-pdf/renderer",
    "@sparticuz/chromium",
    "@sparticuz/chromium-min",
    "puppeteer",
    "puppeteer-core",
  ],
};

export default nextConfig;
