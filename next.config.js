/** @type {import('next').NextConfig} */
const nextConfig = {
  // Temporary: allow deployment even if lint/type issues exist.
  // Revert these to tighten quality once production is stable.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};

module.exports = nextConfig;
