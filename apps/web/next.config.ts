import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  transpilePackages: [
    '@pharmacy/db',
    '@pharmacy/core',
    '@pharmacy/api-contract',
  ],
}

export default nextConfig
