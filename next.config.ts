import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // TEMPORARY: unminified server bundle so the "Cannot read properties of
  // null (reading 'id')" stack trace from /api/onboarding/pair is readable
  // instead of pointing at minified chunk offsets. Revert once root-caused
  // -- this trades server bundle size/perf for debuggability.
  experimental: {
    serverMinification: false,
    turbopackMinify: false,
  },
};

export default nextConfig;
