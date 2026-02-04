/** @type {import('next').NextConfig} */
const path = require('path');
const fs = require('fs');
const globalPolyfillPath = path.join(__dirname, 'src/lib/polyfills/global-polyfill.js');

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
      // Provide global polyfill for Node.js libraries like webtorrent
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
        'pg-native': false,
      };
      
      const webpack = require('webpack');
      
      // Add global polyfill file to the beginning of each entry
      if (typeof config.entry === 'function') {
        const originalEntry = config.entry;
        config.entry = async () => {
          const entries = await originalEntry();
          for (const key in entries) {
            const entry = entries[key];
            if (Array.isArray(entry)) {
              entries[key] = [globalPolyfillPath, ...entry];
            } else if (typeof entry === 'string') {
              entries[key] = [globalPolyfillPath, entry];
            }
          }
          return entries;
        };
      } else if (Array.isArray(config.entry)) {
        config.entry = [globalPolyfillPath, ...config.entry];
      }
      
      // Use DefinePlugin to help with global checks
      config.plugins = [
        ...(config.plugins || []),
        new webpack.DefinePlugin({
          'global.GLOBAL_IS_NODE': JSON.stringify(false),
        }),
      ];
    }
    return config;
  },
};

module.exports = nextConfig;
