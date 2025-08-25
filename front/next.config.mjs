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
  experimental: {
    // Allow output file tracing to include files from the repo root (monorepo-friendly)
    outputFileTracingRoot: path.join(__dirname, '..'),
  },
  webpack: (config) => {
    // Alias to import backend/core code from the repo root
    // Point to compiled JS so ".js" ESM specifiers inside core resolve during Next bundling
    config.resolve.alias['@gs-src'] = path.join(__dirname, '..', 'dist');

    // Safety: allow ".js" specifiers in TS sources to resolve to ".ts/.tsx" during dev
    // (Webpack 5 feature; if not supported by the current resolver it is ignored)
    if (!config.resolve.extensionAlias) config.resolve.extensionAlias = {};
    config.resolve.extensionAlias['.js'] = ['.js', '.ts', '.tsx'];
    config.resolve.extensionAlias['.mjs'] = ['.mjs', '.mts'];
    config.resolve.extensionAlias['.cjs'] = ['.cjs', '.cts'];
    return config;
  },
}

export default nextConfig
