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
    ],
  },
  // Rewrites for API calls (optional - for local dev)
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL || ""}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
