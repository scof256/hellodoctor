import bundleAnalyzer from '@next/bundle-analyzer';

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Temporarily ignore type errors during build to verify bundle sizes
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Temporarily ignore ESLint errors during build
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Optimize production builds
  productionBrowserSourceMaps: false,
  
  // Increase body size limit for audio transcription (API routes)
  proxyClientMaxBodySize: '30mb',
  
  // Increase body size limit for Server Actions
  experimental: {
    serverActions: {
      bodySizeLimit: '30mb',
    },
  },
};

export default withBundleAnalyzer(nextConfig);
