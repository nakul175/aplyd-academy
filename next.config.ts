import type { NextConfig } from "next";

// Node production build (ADR-0001, Option A): a self-contained server in .next/standalone.
const nextConfig: NextConfig = {
  output: "standalone",
  // No next/image is used; image optimisation stays off so the sharp image pipeline is never reachable (ACA-US-12.2).
  images: { unoptimized: true },
};

export default nextConfig;
