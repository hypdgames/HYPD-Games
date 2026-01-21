/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable image optimization for external domains
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "*.preview.emergentagent.com",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
      {
        protocol: "https",
        hostname: "img.gamedistribution.com",
      },
      {
        protocol: "https",
        hostname: "*.railway.app",
      },
      {
        protocol: "https",
        hostname: "games.gamepix.com",
      },
      {
        protocol: "https",
        hostname: "www.gamepix.com",
      },
      {
        protocol: "https",
        hostname: "img.gamepix.com",
      },
    ],
    // Optimize images with these formats
    formats: ["image/avif", "image/webp"],
    // Device sizes for responsive images
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  // Output standalone for optimized production builds
  output: "standalone",
  // Enable compression
  compress: true,
  // Power efficient build options
  poweredByHeader: false,
  // Generate ETags for caching
  generateEtags: true,
};

export default nextConfig;
