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
  // 设置默认端口为5000
  env: {
    PORT: '5000',
  },
};

export default nextConfig;
