import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  outputFileTracingRoot: path.join(__dirname, '..'),
  serverComponentsExternalPackages: ['@prisma/client', 'bcryptjs'],
  experimental: {},
  distDir: '.next',
  trailingSlash: true,
  webpack: (config, { isServer }) => {
    // Aliases for import resolution
    // '@/*' -> front/* (components, app, lib, etc.)
    // '@gs-src/*' -> repo root src/* (server utilities shared to frontend)
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': __dirname,
      '@gs-src': path.join(__dirname, '..', 'src'),
    };

    // Handle Node.js modules that shouldn't be bundled
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
      };
    }

    return config;
  },
  pageExtensions: ['page.tsx', 'page.ts', 'page.jsx', 'page.js'],
};

export default nextConfig;

