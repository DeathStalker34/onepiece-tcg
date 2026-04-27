/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  transpilePackages: ['@optcg/engine', '@optcg/card-data', '@optcg/protocol', '@optcg/ai'],
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
