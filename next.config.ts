/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: __dirname,
  },
  experimental: {
    // Enable runtime configuration for proxy.ts
    runtimeConfig: {
      serverRuntimeConfig: {
        NODE_ENV: process.env.NODE_ENV,
      },
    },
  },
};

export default nextConfig;
