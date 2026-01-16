import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lf3-static.bytednsdoc.com',
        pathname: '/**',
      },
    ],
  },
  output: 'standalone', // 生成独立部署包，解决部署环境兼容性问题
  // 确保静态资源正确加载
  distDir: '.next',
  // 优化静态资源服务
  compress: true,
  // 生产环境优化
  productionBrowserSourceMaps: false,
};

export default nextConfig;
