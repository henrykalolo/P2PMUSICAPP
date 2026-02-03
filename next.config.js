/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  experimental: {
    turbo: {}
  },
  // Webpack configuration for polyfills
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        path: false,
        os: false,
        url: false,
        http: false,
        https: false,
        zlib: false,
        querystring: false,
        dgram: false,
        dns: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
