/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config, { isServer }) => {
    // Exclude backend code from frontend build
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        'ajv': false,
        'openai': false,
        'fs': false,
        'path': false,
        'os': false,
      };
    }
    return config;
  },
  // Only include pages in the pages directory
  pageExtensions: ['page.tsx', 'page.ts', 'page.jsx', 'page.js'],
};

module.exports = nextConfig;
