/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { unoptimized: true },
  output: "standalone",
  async rewrites() {
    return [
      // 1. Places APIs -> Rewritten under /api/v1/places
      {
        source: '/api/v1/places',
        destination: '/api/places',
      },
      {
        source: '/api/v1/places/details',
        destination: '/api/places/details',
      },
      // 2. Auth APIs -> Rewritten under /api/v1/auth
      {
        source: '/api/v1/auth/:path*',
        destination: 'https://ouynmgbfjiduewldcqfs.supabase.co/auth/v1/:path*',
      },
      // 3. Database REST APIs -> Rewritten under /api/v1
      {
        source: '/api/v1/:path*',
        destination: 'https://ouynmgbfjiduewldcqfs.supabase.co/rest/v1/:path*',
      },
    ];
  },
};

module.exports = nextConfig;