/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["xlsx"],
  },
  images: {
    unoptimized: true,
  },
};
module.exports = nextConfig;