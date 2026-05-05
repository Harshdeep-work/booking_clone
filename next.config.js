/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['socket.io'],
  turbopack: {},
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'api.mapbox.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
  // Custom headers for SharedArrayBuffer (WebGL performance)
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
