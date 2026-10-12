import type { NextConfig } from "next";

// Node production build (ADR-0001, Option A): a self-contained server in .next/standalone.
const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
