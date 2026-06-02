import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@wavefinder/db"],
  // Mapbox GL is not SSR-friendly; map loads client-only
};

export default nextConfig;
