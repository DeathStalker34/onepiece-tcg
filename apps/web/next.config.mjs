/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@optcg/engine', '@optcg/card-data'],
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
