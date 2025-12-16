import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  outputFileTracingRoot: path.join(__dirname, '..'),
  experimental: {},
  // Enable Turbopack (Next 16 default) and silence mixed webpack/turbopack error
  turbopack: {},
  distDir: '.next',
  // Avoid unexpected 404s due to slash mismatches in hosting environments
  trailingSlash: false,
  pageExtensions: ['tsx', 'ts', 'jsx', 'js', 'mdx'],
  async headers() {
    return [
      {
        source: '/.well-known/apple-app-site-association',
        headers: [
          { key: 'Content-Type', value: 'application/json' },
          { key: 'Cache-Control', value: 'public, max-age=300' },
        ],
      },
      {
        source: '/.well-known/assetlinks.json',
        headers: [
          { key: 'Content-Type', value: 'application/json' },
          { key: 'Cache-Control', value: 'public, max-age=300' },
        ],
      },
    ]
  },
};

export default nextConfig;

