/** @type {import('next').NextConfig} */
const nextConfig = {
  // turbopack.root removed — let Next.js auto-detect src/pages/
  // Disable static optimization for pages to avoid ISR issues
  trailingSlash: false,
  // Ensure we're not using problematic features
  images: {
    unoptimized: true
  },
  // Configure pages directory
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],
  // External packages for server components — prevent webpack from bundling
  // server-only Node.js packages that use native APIs (net, tls, etc.)
  serverExternalPackages: [
    'redis',
    'pg',
    'pg-native',
    'express',
    'socket.io',
    '@socket.io/redis-adapter',
    'socket.io-redis',
    'prom-client',
    'jsonwebtoken'
  ]
}

module.exports = nextConfig
