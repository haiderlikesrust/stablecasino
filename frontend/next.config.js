const path = require('node:path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname, '..'),
  transpilePackages: [
    '@solana/wallet-adapter-base',
    '@solana/wallet-adapter-phantom',
    '@solana/wallet-adapter-react',
    '@solana/wallet-adapter-react-ui',
    '@solana/wallet-adapter-solflare',
  ],
};

module.exports = nextConfig;
