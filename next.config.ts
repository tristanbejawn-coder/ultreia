import type { NextConfig } from "next";

// Which build is on the phone. Netlify hands the commit to the build; both
// values are inlined into the bundle here so the stamp in the corner of the
// map is the build's own, not the server's idea of it at request time.
const sha = (process.env.COMMIT_REF || '').slice(0, 7)
const built = new Date().toISOString()

const nextConfig: NextConfig = {
  // Photos are served from Supabase Storage; Next's image optimiser is not
  // used (plain <img> keeps the offline story simple), so no remote patterns.
  env: {
    NEXT_PUBLIC_BUILD_SHA: sha || 'local',
    NEXT_PUBLIC_BUILT_AT: built,
  },
};

export default nextConfig;
