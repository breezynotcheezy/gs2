import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
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
  experimental: {},
  webpack: (config, { isServer }) => {
    // Alias to import backend/core code from the repo root
    // Point to compiled JS so ".js" ESM specifiers inside core resolve during Next bundling
    config.resolve.alias['@gs-src'] = path.join(__dirname, '..', 'dist');

    // This makes it so that if you import something that starts with "@/" it will look in the src directory
    config.resolve.alias = {
      ...config.resolve.alias,
      '@/': path.join(__dirname, 'src/'),
    };

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
      
      // Add null-loader for backend files
      config.module.rules.push({
        test: /src\/core\/.*\.ts$/,
        use: 'null-loader',
      });
    }

    // Safety: allow ".js" specifiers in TS sources to resolve to ".ts/.tsx" during dev
    // (Webpack 5 feature; if not supported by the current resolver it is ignored)
    if (!config.resolve.extensionAlias) config.resolve.extensionAlias = {};
    config.resolve.extensionAlias['.js'] = ['.js', '.ts', '.tsx'];
    config.resolve.extensionAlias['.mjs'] = ['.mjs', '.mts'];
    config.resolve.extensionAlias['.cjs'] = ['.cjs', '.cts'];

    return config;
  },
  // Only include pages in the pages directory
  pageExtensions: ['page.tsx', 'page.ts', 'page.jsx', 'page.js'],
}

export default nextConfig
