/** @type {import('next').NextConfig} */
const pick = (...names) => names.map((n) => process.env[n]).find((v) => v && v.trim())?.trim() || '';

const nextConfig = {
  serverExternalPackages: ['sharp'],
  // Keep the existing VITE_* variable names working (inlined into the client bundle).
  env: {
    VITE_GA_MEASUREMENT_ID: pick('VITE_GA_MEASUREMENT_ID', 'GA_MEASUREMENT_ID'),
    VITE_CLARITY_PROJECT_ID: pick('VITE_CLARITY_PROJECT_ID', 'CLARITY_PROJECT_ID'),
    GA_MEASUREMENT_ID: pick('GA_MEASUREMENT_ID', 'VITE_GA_MEASUREMENT_ID'),
    CLARITY_PROJECT_ID: pick('CLARITY_PROJECT_ID', 'VITE_CLARITY_PROJECT_ID'),
    VITE_SUPABASE_URL: pick('VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'),
    VITE_SUPABASE_ANON_KEY: pick('VITE_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    VITE_SUPABASE_SERVICE_ROLE_KEY: pick('VITE_SUPABASE_SERVICE_ROLE_KEY'),
  },
  outputFileTracingIncludes: {
    '/api/[[...path]]': ['./data/**/*'],
  },
};

export default nextConfig;
