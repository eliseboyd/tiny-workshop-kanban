import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // allowedDevOrigins: ['tiny-workshop-kanban.local'], // Uncomment if needed for specific local setups
    serverActions: {
      bodySizeLimit: '5mb',
    },
  },
  images: {
    // Serve AVIF where the browser supports it, fall back to WebP —
    // typically 30-50% smaller than the source PNG/JPEG on mobile.
    formats: ['image/avif', 'image/webp'],
    // Optimized <Image> sources verified against the DB (2026-07): every
    // stored image_url is on the project's own Supabase storage (OG and AI
    // images are downloaded server-side and re-hosted there). Remote
    // inspiration images render with `unoptimized`, which bypasses this
    // allowlist. The previous catch-all `hostname: '**'` let any origin use
    // the image optimizer (cost/abuse surface) and is removed — if a legacy
    // card cover ever 404s, re-add its host here.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'image.pollinations.ai',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'erkflyckhkzzfctexazd.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.thingiverse.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.makerworld.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
