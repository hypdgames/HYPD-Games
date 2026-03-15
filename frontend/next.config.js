/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable gzip/brotli compression
  compress: true,

  // Image optimization
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "img.gamemonetize.com" },
      { protocol: "https", hostname: "img.gamepix.com" },
      { protocol: "https", hostname: "games.gamepix.com" },
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "kmgymgivnactoigjfbbh.supabase.co" },
    ],
    // Optimize image delivery
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    formats: ["image/webp"],
    minimumCacheTTL: 3600,
  },

  // HTTP response caching headers for static assets
  async headers() {
    return [
      {
        // Static assets — cache for 1 year
        source: "/_next/static/(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        // Images and icons — cache for 7 days
        source: "/(.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico))",
        headers: [
          { key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" },
        ],
      },
      {
        // Fonts — cache for 1 year
        source: "/(.*\\.(?:woff|woff2|ttf|otf|eot))",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },

  // Reduce bundle size
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
};

module.exports = nextConfig;
