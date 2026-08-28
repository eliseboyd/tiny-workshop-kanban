import path from "path";
import type { NextConfig } from "next";

// The board is served from tinywork.shop/kanban (the apex belongs to the hub
// site). Next prefixes next/link, next/router, next/image, the middleware
// matcher, and next.config headers/redirects automatically. It does NOT
// prefix hand-written absolute strings — static asset URLs in `metadata`,
// public/site.webmanifest, or anything built from window.location.origin — so
// those read BASE_PATH below. Exported to the browser bundle as
// NEXT_PUBLIC_BASE_PATH so client components can build the same URLs.
// Rollback for the cutover is setting this back to "".
const BASE_PATH = "/kanban";

const nextConfig: NextConfig = {
  basePath: BASE_PATH,
  env: {
    NEXT_PUBLIC_BASE_PATH: BASE_PATH,
  },
  // Parent of the repo, so a locally linked ../design-system (@eliseboyd/design)
  // resolves during local dev; harmless when the dep is installed from git.
  turbopack: {
    root: path.join(__dirname, ".."),
  },
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
    // Optimized <Image> sources verified against the DB: every stored
    // image_url is on merlin's Supabase storage (OG and AI images are
    // downloaded server-side and re-hosted there). The host moved from the
    // old Kanban project to merlin in the 2026-08 consolidation — if this
    // is not kept in step with the storage host, thumbnails break while
    // detail views keep working, since only the optimizer checks it. Remote
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
        hostname: 'qdhjpewnwtaqwnpkyacc.supabase.co',
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
