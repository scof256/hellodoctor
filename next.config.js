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
};

export default withBundleAnalyzer(nextConfig);
