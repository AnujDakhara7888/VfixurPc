/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Lint locally (npm run lint) instead of failing production builds on style rules.
  eslint: { ignoreDuringBuilds: true },
};

module.exports = nextConfig;
