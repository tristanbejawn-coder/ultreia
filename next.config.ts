import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Photos are served from Supabase Storage; Next's image optimiser is not
  // used (plain <img> keeps the offline story simple), so no remote patterns.
};

export default nextConfig;
