import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // allowedDevOrigins: ['tiny-workshop-kanban.local'], // Uncomment if needed for specific local setups
    serverActions: {
      bodySizeLimit: '5mb',
    },
  },
  images: {
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
      // Allow common OG image domains
      {
        protocol: 'https',
        hostname: '**.youtube.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.ytimg.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.vimeo.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.vimeocdn.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.imgur.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.github.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.githubusercontent.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.medium.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.twitter.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.twimg.com',
        port: '',
        pathname: '/**',
      },
      // Allow any HTTPS domain for OG images
      {
        protocol: 'https',
        hostname: '**',
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
