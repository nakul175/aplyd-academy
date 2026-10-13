import type { NextConfig } from 'next';

// Node production build (ADR-0001, Option A): a self-contained server in .next/standalone.
const nextConfig: NextConfig = {
  output: 'standalone',
  // No next/image is used; image optimisation stays off so the sharp image pipeline is never reachable (ACA-US-12.2).
  images: { unoptimized: true },
  // Put the page title in the first HTML for every visitor instead of streaming it in later: screen readers and
  // the WCAG check read the title as soon as the page loads (it was intermittently missing on dynamic pages).
  htmlLimitedBots: /.*/,
};

export default nextConfig;
