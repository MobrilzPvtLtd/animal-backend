/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { unoptimized: true },
  output: "standalone",
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: 'https://ouynmgbfjiduewldcqfs.supabase.co/rest/v1/:path*',
      },
      {
        source: '/api/auth/:path*',
        destination: 'https://ouynmgbfjiduewldcqfs.supabase.co/auth/v1/:path*',
      },
    ];
  },
};

module.exports = nextConfig;