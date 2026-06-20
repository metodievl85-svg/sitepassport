import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['@imgly/background-removal', 'onnxruntime-web', 'onnxruntime-node'],
  turbopack: {
    resolveAlias: {
      sharp: false,
      'onnxruntime-node': false,
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      sharp$: false,
      'onnxruntime-node$': false,
    }
    return config
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(self)' },
        ],
      },
    ]
  },
}

export default nextConfig
