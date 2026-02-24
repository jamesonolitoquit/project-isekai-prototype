/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable static optimization for pages to avoid ISR issues
  trailingSlash: false,
  // Ensure we're not using problematic features
  images: {
    unoptimized: true
  }
}

module.exports = nextConfig