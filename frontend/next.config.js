/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow images from Amazon
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**/*.amazon.**',
      },
      {
        protocol: 'https',
        hostname: '**.*',
      },
    ],
  },
};

module.exports = nextConfig;

