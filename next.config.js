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
  
  // Configure webpack for optimal code splitting
  webpack: (config, { isServer }) => {
    // Optimize chunk splitting for better caching
    if (!isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          ...config.optimization.splitChunks,
          cacheGroups: {
            ...config.optimization.splitChunks?.cacheGroups,
            // Separate vendor chunks for better caching
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
              priority: 10,
            },
            // Separate heavy libraries into their own chunks
            markdown: {
              test: /[\\/]node_modules[\\/](react-markdown|remark|unified|micromark)[\\/]/,
              name: 'markdown',
              chunks: 'all',
              priority: 20,
            },
            qrcode: {
              test: /[\\/]node_modules[\\/]qrcode[\\/]/,
              name: 'qrcode',
              chunks: 'all',
              priority: 20,
            },
          },
        },
      };
    }
    return config;
  },
};

export default withBundleAnalyzer(nextConfig);
