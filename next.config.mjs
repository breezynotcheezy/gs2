/** @type {import('next').NextConfig} */
const nextConfig = {
  // This file is intentionally left empty as the main configuration is in front/next.config.mjs
  // This prevents Next.js from trying to build the root directory
  output: 'export',
  // Add a custom webpack config that does nothing to prevent build errors
  webpack: (config) => config,
  // Disable file-system routing in the root
  pageExtensions: [],
}

export default nextConfig
